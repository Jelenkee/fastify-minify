const { fastify: Fastify } = require("fastify");

const fastify = new Fastify({
    //logger:true
});
const fs = require("fastify-static");

fastify.get("/", (req, rep) => {
    fastify.minifyJS("const f    = 99 ; ").then(console.log).catch(console.log)
    fastify.minifyCSS(".alpha    .bet {  color :   red ; }").then(console.log).catch(console.log)
    fastify.minifyHTML("<b>\nhEy\n   </b>")
        .then(res => rep.type("text/html").send(res)).catch(console.log);

})

fastify.register(require("./index"), {
    //cacheSize:99
})
fastify.register(fs, {
    root: __dirname,
})

fastify.listen(3210, console.log)