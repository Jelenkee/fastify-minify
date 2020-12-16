/// <reference types="node"/>

import { MinifyOptions, CompressOptions } from "csso";
import { Options } from "html-minifier-terser";
import { MinifyOptions as TerserMinifyOptions } from "terser";
import { FastifyPluginCallback, FastifyRequest, FastifyReply } from "fastify";
import { Stream } from "stream"

type CSSOOptions = MinifyOptions & CompressOptions;

export interface FastifyMinifyOptions {
    cacheSize: number;
    global: boolean;
    minInfix: (req: FastifyRequest) => void;
    suffixes: Array<string>;
    validate: (req: FastifyRequest, rep: FastifyReply, payload: string | Buffer | Stream) => boolean;
    htmlOptions: Options;
    jsOptions: TerserMinifyOptions;
    cssOptions: CSSOOptions;
}

declare const fastifyMinify: FastifyPluginCallback<FastifyMinifyOptions>;

export default fastifyMinify;