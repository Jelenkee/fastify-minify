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
const DEFAULT_JS_OPTIONS = {};
const DEFAULT_CSS_OPTIONS = {};
const DEFAULT_CACHE_SIZE = 1000;

let lru;

function plugin(instance, opts, done) {
    opts = opts || {};
    const htmlOptions = Object.assign({}, DEFAULT_HTML_OPTIONS, opts.htmlOptions);
    const jsOptions = Object.assign({}, DEFAULT_JS_OPTIONS, opts.jsOptions);
    const cssOptions = Object.assign({}, DEFAULT_CSS_OPTIONS, opts.cssOptions);

    const cacheSize = opts.cacheSize == null ? null : typeof opts.cacheSize === "number" ? opts.cacheSize : DEFAULT_CACHE_SIZE;

    if (opts.global || true) {
        instance.addHook("onSend", (req, rep, payload, done) => {
            const contentType = rep.getHeader("content-type") || "";
            if (true) {
                done(null, "paradis")
                return;
            }
            if (payload) {
                if (contentType.includes("application/javascript")) {
                    const t1 = new Date().getTime()
                    toStringPromise(payload)
                        .then(pl => { console.log(new Date().getTime() - t1); return pl })
                        .then(pl => { console.log(new Date().getTime() - t1); return minifyJS(pl) })
                        .then(pl => { console.log(new Date().getTime() - t1); return done(null, "party") })
                        .catch(err => done(err))
                } else {
                    done(null, payload)
                }
            } else {
                done(null, payload);
            }
        })
    }


    if (cacheSize) {
        lru = new LRU({ maxSize: cacheSize });
    }

    function minifyHTML(value, callback) {
        const cachedValue = getCachedValue(HTML_PREFIX, value);
        if (cachedValue != null) {
            return cachedValue;
        }
        const result = htmlMinifier.minify(value, htmlOptions);
        setCachedValue(HTML_PREFIX, value, result);
        if (typeof callback === "function") {
            callback(null, result);
        } else {
            return Promise.resolve(result);
        }
    }
    function minifyJS(value, callback) {
        const cachedValue = getCachedValue(JS_PREFIX, value);
        if (cachedValue != null) {
            return cachedValue;
        }
        const t1 = new Date().getTime();
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
            return cachedValue;
        }
        const result = csso.minify(value, cssOptions).css;
        setCachedValue(CSS_PREFIX, value, result);
        if (typeof callback === "function") {
            callback(null, result);
        } else {
            return Promise.resolve(result);
        }
    }
    instance.decorate("minifyHTML", minifyHTML);
    instance.decorate("minifyJS", minifyJS);
    instance.decorate("minifyCSS", minifyCSS);
    done();
}

function getCachedValue(prefix, key) {
    if (!lru) {
        return;
    }
    return lru.get(prefix + key);
}

function setCachedValue(prefix, key, value) {
    if (!lru) {
        return value;
    }
    lru.set(prefix + key, value);
    return value;
}

function toStringPromise(value) {
    if (value == null) {
        return Promise.resolve(value);
    }
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