const fp = require("fastify-plugin");
const htmlMinifier = require("html-minifier-terser");
const terser = require("terser");
const csso = require("csso");
const LRU = require("quick-lru");
const getStream = require("get-stream");
require("array-flat-polyfill");

const DEFAULT_JS_OPTIONS = {
    sourceMap: false,
    compress: true,
    mangle: true
};
const DEFAULT_CSS_OPTIONS = {};
const DEFAULT_HTML_OPTIONS = {
    removeComments: true,
    collapseWhitespace: true,
    minifyCSS: true,
    minifyJS: DEFAULT_JS_OPTIONS
};

const PLUGIN_SYMBOL = Symbol.for("registered-plugin");

function plugin(instance, opts, done) {
    opts = opts || {};
    const htmlOptions = Object.assign({}, DEFAULT_HTML_OPTIONS, opts.htmlOptions);
    const jsOptions = Object.assign({}, DEFAULT_JS_OPTIONS, opts.jsOptions);
    const cssOptions = Object.assign({}, DEFAULT_CSS_OPTIONS, opts.cssOptions);

    const lru = typeof opts.cache === "number" ? new LRU({ maxSize: opts.cache })
        : opts.cache && typeof opts.cache.get === "function" && typeof opts.cache.set === "function"
            ? opts.cache : null;
    const validate = typeof opts.validate === "function" ? opts.validate : () => true;
    const minInfixFunction = typeof opts.minInfix === "function" ? opts.minInfix : opts.minInfix ? () => true : null;

    const defaultTransformers = [
        {
            suffix: "js",
            contentType: ["application/javascript", "text/javascript"],
            decorate: "minifyJS",
            func: value => terser.minify(value, jsOptions).then(r => r.code),
        },
        {
            suffix: "css",
            contentType: "text/css",
            decorate: "minifyCSS",
            func: value => csso.minify(value, cssOptions).css,
        },
        {
            suffix: "html",
            contentType: "text/html",
            decorate: "minifyHTML",
            func: value => htmlMinifier.minify(value, htmlOptions),
        },
        {
            suffix: "json",
            contentType: "application/json",
            func: value => JSON.stringify(JSON.parse(value), null, 0)
        }
    ];

    let transformers = defaultTransformers.slice();
    if (Array.isArray(opts.transformers)) {
        for (const t of opts.transformers) {
            const oldTransformer = getTransformerForSuffix(t.suffix || "");
            if (oldTransformer) {
                Object.assign(oldTransformer, t);
            } else {
                transformers.push(t);
            }
        }
    }
    transformers = transformers.filter(t => t.func);

    transformers.forEach(t => {
        t.suffix = wrap(t.suffix).map(s => s.toLowerCase());
        t.contentType = wrap(t.contentType).map(s => s.toLowerCase());
        enhanceFunction(t);
        if (t.decorate && typeof t.decorate === "string") {
            instance.decorate(t.decorate, t.func)
        }
    });

    const suffixes = transformers.flatMap(t => t.suffix);

    function enhanceFunction(transformer) {
        const prefix = transformer.suffix.toString();
        const oldFunc = transformer.func;
        const promisedFunc = async v => oldFunc(v);
        const useCache = "useCache" in transformer ? transformer.useCache : true;
        transformer.func = async value => {
            if (useCache) {
                const cachedValue = await getCachedValue(prefix, value);
                if (cachedValue != null) {
                    return cachedValue;
                }
            }
            const result = await promisedFunc(value);
            if (useCache) {
                setCachedValue(prefix, value, result);
            }
            return result;
        }
    }

    function getCachedValue(prefix, key) {
        if (!lru) { return; }
        return lru.get(prefix + key);
    }

    function setCachedValue(prefix, key, value) {
        if (!lru) { return value; }
        lru.set(prefix + key, value);
        return value;
    }

    if (opts.global || minInfixFunction) {
        instance.addHook("onSend", (req, rep, payload, done) => {
            if (payload && (opts.global || req.mini)) {
                const contentType = rep.getHeader("content-type") || "";
                const transformer = getTransformerForContentType(contentType);
                if (transformer && validate(req, rep, payload)) {
                    rep.header("content-length", null);
                    toStringPromise(payload)
                        .then(pl => transformer.func(pl))
                        .then(pl => done(null, pl))
                        .catch(err => done(err));
                    return;
                }
            }
            done(null, payload);
        })
    }

    function getTransformerForContentType(contentType) {
        contentType = contentType.toLowerCase();
        return transformers.filter(t => t.contentType.some(ct => contentType.includes(ct)))[0];
    }

    if (minInfixFunction) {
        instance.decorateRequest("mini", false);
        instance.addHook("onRequest", (req, rep, done) => {
            const filePath = req.params["*"];
            if (req.method === "GET"
                && typeof filePath === "string"
                && typeof req.context.config.url === "string"
                && req.context.config.url.endsWith("/*")
                && suffixes.some(s => filePath.toLowerCase().endsWith(".min." + s))
                && getTransformerForSuffix(filePath.substring(filePath.lastIndexOf(".") + 1).toLowerCase())
                && minInfixFunction(req, filePath)
            ) {
                req.mini = true;
                req.params["*"] = req.params["*"].replace(/\.min\./, ".");
            }
            done();
        })
    }

    function getTransformerForSuffix(suffix) {
        suffix = suffix.toLowerCase();
        return transformers.filter(t => t.suffix.includes(suffix))[0];
    }

    instance.addHook("onReady", done => {
        if (minInfixFunction && instance[PLUGIN_SYMBOL].indexOf("fastify-static") === -1)
            done(new Error("fastify-static is not present. Either register it or disable minInfix."));
        else
            done();
    })

    done();
}

function toStringPromise(value) {
    const type = typeof value;

    if (type === "string") {
        return Promise.resolve(value);
    }
    if (Buffer.isBuffer(value)) {
        return Promise.resolve(value.toString());
    }
    if (typeof value === "object" && typeof value.pipe === "function") {
        return getStream(value);
    }
    throw new Error("unsupported type");
}

function wrap(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

module.exports = fp(plugin, {
    fastify: ">=3.x.x",
    name: "fastify-minify",
});
