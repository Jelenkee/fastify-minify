# fastify-minify
![](https://badgen.net/npm/v/fastify-minify)
![](https://badgen.net/npm/dt/fastify-minify)

A plugin for Fastify to minify HTML, JS and CSS. And you can transform any response as your like.

## Usage

```js
const fastify = require("fastify")();

fastify.register(require("fastify-minify"), {
    cacheSize: 2000,
});

fastify.get("/minfiedCSS", function (req, rep) {
    const css = getSomeCSS();
    rep.type("text/css").send(this.minifyCSS(css));
});

```

Three methods are added to the fastify instance. `minifyHTML`, `minifyJS` and `minifyCSS`. All of them take a string as input and an optional callback (`function(err, result)`). If no callback is provided, they will return a promise.

By default no response is minified automatically. You can enable it with `global` or `minInfix`.

## Options

```js
fastify.register(require("fastify-minify"), {
    cacheSize: 2500,
    global: true,
    minInfix: (req, filePath) => req.query.mini === "true",
    validate: (req, rep, payload) => typeof payload === "string",
    htmlOptions: { caseSensitive: true },
    jsOptions: { "keep-classnames": true },
    cssOptions: {},
    transformers: [
        {
            suffix: "txt",
            contentType: "text/plain",
            func: value => value.toUpperCase(),
            decorate: "upperCaseText",
            useCache: false
        }
    ]
});
```

#### `cacheSize`
* Size of the lru-cache. It is used to cache the minification results. Use a falsy value to disable the cache.
* default: `0`
* type: number

#### `global`
* If truthy, every response with content type html, js or css will be minified. See `validate`.
* default: `false`
* type: boolean

#### `minInfix`
* If truthy or a function (`function(req, filePath)`) that returns a truthy value, a new path for static files will be added with min-infix e.g. `public/foo.min.css` for `public/foo.css`. You need to have [fastify-static](https://github.com/fastify/fastify-static) installed to use it. The function is called `onRequest`.
❗ If you have static files with min-infix, they will be ignored.
* default: `false`
* type: boolean | function

#### `validate`
* If this function (`function(req, rep, payload)`) returns a truthy value, the payload will be minified. It is called `onSend` and only if `global` or `minInfix` is enabled.
* default: `() => true`
* type: function

#### `htmlOptions`
* An object that will be passed to [html-minifier-terser](https://github.com/DanielRuf/html-minifier-terser).
* default: `{}`
* type: object

#### `jsOptions`
* An object that will be passed to [terser](https://github.com/terser/terser).
* default: `{}`
* type: object

#### `cssOptions`
* An object that will be passed to [csso](https://github.com/css/csso).
* default: `{}`
* type: object

#### `transformers`
* An array of transformers to transform any response. There are three transformers built-in (JS, HTML, CSS).
    * `suffix`
        * Suffix of files to transform. Used when `minInfix` is enabled.
        * type: string | array of strings
    * `contentType`
        * Content type of response. Used when `global` or `minInfix` is enabled.
        * type: string | array of strings
    * `func`
        * Function to transform the response.
        * type: function (`string => string | string => Promise<string>`)
    * `decorate` (optional)
        * Method name of the decorated function.
        * type: string
    * `useCache` (optional)
        * If true, cache is used when transforming. Enabled by default.
        * type: boolean
    * To disable one of the built-in transformers you can add a transformer with respective suffix e.g. `{ suffix: "js", func: null }`
* default: `[]`
* type: array

