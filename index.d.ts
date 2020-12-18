/// <reference types="node"/>

import { MinifyOptions, CompressOptions } from "csso";
import { Options } from "html-minifier-terser";
import { MinifyOptions as TerserMinifyOptions } from "terser";
import { FastifyPluginCallback, FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { Stream } from "stream"

declare module "fastify" {
    interface FastifyInstance {
        minifyHTML(value: string, callback: (err: any, result: string) => void): void;
        minifyHTML(value: string): Promise<string>;
        minifyJS(value: string, callback: (err: any, result: string) => void): void;
        minifyJS(value: string): Promise<string>;
        minifyCSS(value: string, callback: (err: any, result: string) => void): void;
        minifyCSS(value: string): Promise<string>;
    }
}

type CSSOOptions = MinifyOptions & CompressOptions;

export interface FastifyMinifyOptions {
    cacheSize: number;
    global: boolean;
    minInfix: (req: FastifyRequest) => void;
    suffixes: string[];
    validate: (req: FastifyRequest, rep: FastifyReply, payload: string | Buffer | Stream) => boolean;
    htmlOptions: Options;
    jsOptions: TerserMinifyOptions;
    cssOptions: CSSOOptions;
}

declare const fastifyMinify: FastifyPluginCallback<FastifyMinifyOptions>;

export default fastifyMinify;