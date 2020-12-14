const { fastify: Fastify } = require("fastify");

const fastify = new Fastify({
    //logger:true
});

const fs = require("fastify-static");
fastify.register(require("./index"), {
    cacheSize:99,
    //global: true,
    minInfix:true
})
fastify.get("/", (req, rep) => {
    fastify.minifyJS("const fffffffffffffffff    = 'c' ;let r=fffffffffffffffff ").then(console.log).catch(console.log)
    fastify.minifyCSS(".alpha    .bet {  color :   red ; }").then(console.log).catch(console.log)
    fastify.minifyHTML("<b>\nhEy\n   </b>")
        .then(res => rep.type("text/html").send(res)).catch(console.log);

})

fastify.register(fs, {
    root: __dirname,
    prefix:"/public/"
})

fastify.listen(3210, console.log)