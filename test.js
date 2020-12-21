const { test } = require("tap");
const Fastify = require("fastify");
const fastifyStatic = require("fastify-static");
const fm = require("./index");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

const mainCSS = fs.readFileSync(path.join(__dirname, "testfiles", "public", "main.css")).toString();
const mainJS = fs.readFileSync(path.join(__dirname, "testfiles", "public", "main.js")).toString();
const mainHTML = fs.readFileSync(path.join(__dirname, "testfiles", "index.html")).toString();

test("decorators", t => {
    t.plan(8);

    const fastify = newFastify();

    fastify.ready(async () => {
        t.ok(fastify.minifyHTML);
        t.ok(fastify.minifyJS);
        t.ok(fastify.minifyCSS);

        const html1 = "<a  href = \"#\">\n AA  </a>", html2 = "<a href=\"#\">AA</a>";
        const js1 = "const  ZZZZ = 9 ;;; console.   log(ZZZZ)", js2 = "const ZZZZ=9;console.log(9);";
        const css1 = ".a  { color :  red  ;}   .b  { color :  red  ;}", css2 = ".a,.b{color:red}";

        t.equal(await fastify.minifyHTML(html1), html2);
        t.equal(await fastify.minifyJS(js1), js2);
        t.equal(await fastify.minifyCSS(css1), css2);

        t.rejects(fastify.minifyHTML("<a  href = \"#\"> < / a>"));
        t.rejects(fastify.minifyJS("const {{ let ("));
    });
});

test("global", t => {
    t.plan(10);

    const fastify = newFastify({ global: true, validate: () => t.ok(1) });
    fastify.register(fastifyStatic, { root: path.join(__dirname, "testfiles") });

    fastify.get("/string", (req, rep) => rep.type("text/css").send(mainCSS));
    fastify.get("/buffer", (req, rep) => rep.type("text/css").send(Buffer.from(mainCSS)));
    fastify.get("/stream", (req, rep) => rep.type("text/css").send(Readable.from(mainCSS)));
    fastify.get("/null", (req, rep) => rep.type("text/css").send(null));

    fastify.inject().get("/string").end().then(res => t.ok(minifiedCSS(res.body)));
    fastify.inject().get("/buffer").end().then(res => t.ok(minifiedCSS(res.body)));
    fastify.inject().get("/stream").end().then(res => t.ok(minifiedCSS(res.body)));
    fastify.inject().get("/null").end().then(res => t.notOk(res.body));

    fastify.inject().get("/public/main.css").end().then(res => t.ok(minifiedCSS(res.body)));

    const fastify2 = newFastify({ global: true, validate: () => false });
    fastify2.get("/", (req, rep) => rep.type("text/css").send(mainCSS));
    fastify2.inject().get("/").end().then(res => t.equal(res.body, mainCSS));
});

test("minInfix", t => {
    t.plan(12);
    t.rejects(newFastify({ minInfix: true }).ready());
    const fastify = newFastify({ minInfix: (req, filePath) => filePath.endsWith(".css") || filePath.endsWith(".html") });
    fastify.register(fastifyStatic, { root: path.join(__dirname, "testfiles") });
    t.resolves(fastify.ready());

    fastify.inject().get("/public/main.min.css").end().then(res => t.ok(minifiedCSS(res.body)));
    fastify.inject().get("/public/main.css").end().then(res => t.equal(res.body, mainCSS));
    fastify.inject().get("/public/main.min.js").end().then(res => t.equal(res.statusCode, 404));
    fastify.inject().get("/index.min.html").end().then(res => t.equal(res.statusCode, 200) && t.ok(res.body.length < mainHTML.length));

    const fastify2 = newFastify({ minInfix: req => t.ok(1) && req.url.includes("css") });
    fastify2.register(fastifyStatic, { root: path.join(__dirname, "testfiles") });
    fastify2.inject().get("/index.min.html").end().then(res => t.equal(res.statusCode, 404));
    fastify2.inject().get("/public/main.min.css").end().then(res => t.ok(minifiedCSS(res.body)));

    const fastify3 = newFastify();
    fastify3.register(fastifyStatic, { root: path.join(__dirname, "testfiles") });
    fastify3.inject().get("/public/main.min.css").end().then(res => t.equal(res.body, "minify"));

});

test("global & minInfix", t => {
    t.plan(3);
    const fastify = newFastify({ minInfix: true, global: true });
    fastify.register(fastifyStatic, { root: path.join(__dirname, "testfiles") });
    Promise.all([fastify.inject().get("/public/main.js").end(), fastify.inject().get("/public/main.min.js").end()])
        .then(results => {
            t.equal(results[0].statusCode, 200);
            t.equal(results[0].body, results[1].body);
            t.ok(results[0].body.length < mainJS.length);
        });
});

test("transformers", t => {
    t.plan(4);
    const fastify = newFastify({
        transformers: [
            {
                suffix: "txt",
                contentType: "text/plain",
                func: value => value.toUpperCase(),
                decorate: "ttt"
            },
            {
                suffix: "html",
                func: null,
            }
        ],
        minInfix: true,
        global: true
    });
    fastify.register(fastifyStatic, { root: path.join(__dirname, "testfiles") });
    fastify.get("/", (req, rep) => rep.type("text/plain").send("bar"));

    fastify.inject().get("/public/test.txt").end().then(res => t.equal(res.body, "JAVASCRIPT"));
    fastify.inject().get("/").end().then(res => t.equal(res.body, "BAR"));
    fastify.inject().get("/index.min.html").end().then(res => t.equal(res.statusCode, 404));


    fastify.ready(async () => {
        t.equal(await fastify.ttt("foo"), "FOO");
    });

});

test("options", t => {
    t.plan(2);
    const fastify1 = newFastify();
    const fastify2 = newFastify({
        jsOptions: { mangle: false, compress: false },
        htmlOptions: { minifyJS: false }
    });

    function jsHandler(req, rep) {
        this.minifyJS(mainJS).then(r => rep.type("application/javascript").send(r));
    }
    function htmlHandler(req, rep) {
        this.minifyHTML(mainHTML).then(r => rep.type("text/html").send(r));
    }

    fastify1.get("/j", jsHandler);
    fastify1.get("/h", htmlHandler);
    fastify2.get("/j", jsHandler);
    fastify2.get("/h", htmlHandler);

    Promise.all([fastify1.inject().get("/j").end(), fastify2.inject().get("/j").end()])
        .then(arr => t.ok(arr[0].body.length < arr[1].body.length));
    Promise.all([fastify1.inject().get("/h").end(), fastify2.inject().get("/h").end()])
        .then(arr => t.ok(arr[0].body.length < arr[1].body.length));
});

test("cache", t => {
    t.plan(9)

    const fastify = newFastify({ cache: 100 });

    fastify.get("/", (req, rep) => {
        fastify.minifyCSS(mainCSS).then(r => rep.type("text/css").send(r))
    });

    let time1, time2, time3;
    time1 = new Date().getTime();
    fastify.inject({
        method: "GET",
        url: "/"
    }, (err, res1) => {
        t.error(err);
        time2 = new Date().getTime();
        fastify.inject({
            method: "GET",
            url: "/"
        }, (err2, res2) => {
            t.error(err2);
            time3 = new Date().getTime();
            t.ok(mainCSS.length > res1.body.length);
            t.equal(res1.statusCode, 200);
            t.equal(res1.body, res2.body);
            t.ok(time3 - time2 < time2 - time1);
            t.ok(time3 - time2 < 10);
        });
    });

    let count = 0;
    const fastify2 = newFastify({
        cache: {
            set: (k, v) => count++,
            get: (k) => count === 0 ? null : Promise.resolve("party")
        }
    });
    fastify2.get("/", (req, rep) => {
        fastify2.minifyCSS(mainCSS).then(r => rep.type("text/css").send(r))
    });

    fastify2.inject().get("/").end()
        .then(res => fastify2.inject().get("/").end()
            .then(res => {
                t.equal(res.body, "party");
                t.equal(count, 1);
            }));
});


function newFastify(opts = {}) {
    return new Fastify().register(fm, opts);
}

function minifiedCSS(value) {
    return value.includes("padding") && value.length < mainCSS.length;
}
