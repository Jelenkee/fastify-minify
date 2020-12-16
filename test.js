const { fastify: Fastify } = require("fastify");

const fastify = new Fastify({
    //logger:true
});

const fs = require("fastify-static");
const fm = require("./index");
fastify.register(fm, {
    cacheSize: 99,
    //global: true,
    minInfix: true
})
fastify.get("/", function (req, rep) {
    fastify.minifyJS("const fffffffffffffffff    = 'c' ;let r=fffffffffffffffff ").then(console.log).catch(console.log)
    fastify.minifyCSS("    .bet {  color :   red ; } .alpha{color:red}").then(console.log).catch(console.log)
    fastify.minifyHTML("<b>\nhEy\n   </b>")
        .then(res => rep.type("text/html").send(res)).catch(console.log);
    console.log(req.query);

})

fastify.register(fs, {
    root: __dirname,
    prefix: "/public/"
})

fastify.listen(3210, console.log)