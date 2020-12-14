const fp = require("fastify-plugin");
const htmlMinifier = require("html-minifier-terser");
const terser = require("terser");
const csso = require("csso");
const LRU = require("quick-lru");
const getStream = require("get-stream");

const HTML_PREFIX = "%HTML§";
const JS_PREFIX = "%JS§";
const CSS_PREFIX = "%CSS§";

const DEFAULT_HTML_OPTIONS = {
    minifyCSS: true,
    minifyJS: true,
    removeComments: true,
    collapseWhitespace: true
};
const DEFAULT_JS_OPTIONS = {
    sourceMap: false,
    compress: true,
    mangle: true
};
const DEFAULT_CSS_OPTIONS = {};
const DEFAULT_CACHE_SIZE = 1000;
const DEFAULT_SUFFIXES = ["js", "css", "html"];

const PLUGIN_SYMBOL = Symbol.for("registered-plugin");

let lru;

function plugin(instance, opts, done) {
    opts = opts || {};
    const htmlOptions = Object.assign({}, DEFAULT_HTML_OPTIONS, opts.htmlOptions);
    const jsOptions = Object.assign({}, DEFAULT_JS_OPTIONS, opts.jsOptions);
    const cssOptions = Object.assign({}, DEFAULT_CSS_OPTIONS, opts.cssOptions);

    const cacheSize = opts.cacheSize == null ? null : typeof opts.cacheSize === "number" ? opts.cacheSize : DEFAULT_CACHE_SIZE;
    const validate = typeof opts.validate === "function" ? opts.validate : () => true;

    const suffixes = opts.suffixes || DEFAULT_SUFFIXES;


    if (opts.global || opts.minInfix) {
        instance.addHook("onSend", (req, rep, payload, done) => {
            if (payload && (opts.global || (opts.minInfix && req.mini))) {
                const contentType = rep.getHeader("content-type") || "";
                if (contentType.includes("application/javascript") || contentType.includes("text/javascript")) {
                    if (minify(req, rep, payload, minifyJS, done)) { return; }
                } else if (contentType.includes("text/css")) {
                    if (minify(req, rep, payload, minifyCSS, done)) { return; }
                } else if (contentType.includes("application/xhtml+xml") || contentType.includes("text/html")) {
                    if (minify(req, rep, payload, minifyHTML, done)) { return; }
                }
            }
            done(null, payload);
        })
        function minify(req, rep, payload, miniFunction, done) {
            if (validate(req, rep, payload)) {
                rep.header("content-length", null);
                return toStringPromise(payload)
                    .then(pl => miniFunction(pl))
                    .then(pl => done(null, pl))
                    .catch(err => done(err))
            }
        }
    }

    instance.ready().finally(() => {
        if (opts.minInfix && instance[PLUGIN_SYMBOL].indexOf("fastify-static") === -1)
            throw new Error("fastify-static is not present")
    })

    if (opts.minInfix) {
        instance.decorateRequest("mini", false);
        instance.addHook("onRequest", (req, rep, done) => {
            if (req.method === "GET"
                && typeof req.context.config.url === "string"
                && req.context.config.url.endsWith("/*")
                && typeof req.params["*"] === "string"
                && suffixes.some(s => req.params["*"].endsWith(".min." + s))
            ) {
                req.mini = true;
                req.params["*"] = req.params["*"].replace(/\.min/, "");
                //check if rewriteurl is possible
            }
            done();
        })
    }

    if (cacheSize) {
        lru = new LRU({ maxSize: cacheSize });
    }

    function minifyHTML(value, callback) {
        const cachedValue = getCachedValue(HTML_PREFIX, value);
        if (cachedValue != null) {
            return choose(cachedValue, callback);
        }
        const result = htmlMinifier.minify(value, htmlOptions);
        setCachedValue(HTML_PREFIX, value, result);
        return choose(result, callback);
    }
    function minifyJS(value, callback) {
        const cachedValue = getCachedValue(JS_PREFIX, value);
        if (cachedValue != null) {
            return choose(cachedValue, callback);
        }
        const promise = terser.minify(value, jsOptions)
            .then(result => setCachedValue(JS_PREFIX, value, result.code));
        if (typeof callback === "function") {
            promise
                .then(result => callback(null, result))
                .catch(error => callback(error))
        } else {
            return promise;
        }
    }
    function minifyCSS(value, callback) {
        const cachedValue = getCachedValue(CSS_PREFIX, value);
        if (cachedValue != null) {
            return choose(cachedValue, callback);
        }
        const result = csso.minify(value, cssOptions).css;
        setCachedValue(CSS_PREFIX, value, result);
        return choose(result, callback);
    }
    instance.decorate("minifyHTML", minifyHTML);
    instance.decorate("minifyJS", minifyJS);
    instance.decorate("minifyCSS", minifyCSS);
    done();
}

function choose(result, callback) {
    if (typeof callback === "function") {
        return callback(null, result);
    } else {
        return Promise.resolve(result);
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


module.exports = fp(plugin, {
    fastify: ">=3.x.x",
    name: "fastify-minify",
})