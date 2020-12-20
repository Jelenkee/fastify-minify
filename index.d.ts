/// <reference types="node"/>

import { MinifyOptions, CompressOptions } from "csso";
import { Options } from "html-minifier-terser";
import { MinifyOptions as TerserMinifyOptions } from "terser";
import { FastifyPluginCallback, FastifyRequest, FastifyReply } from "fastify";
import { Stream } from "stream";

type CSSOOptions = MinifyOptions & CompressOptions;

export interface Transformer {
    suffix: string | string[];
    contentType: string | string[];
    func: ((value: string) => string) | ((value: string) => Promise<string>);
    decorate?: string;
    useCache?: boolean;
}

export interface FastifyMinifyOptions {
    cacheSize?: number;
    global?: boolean;
    minInfix?: boolean | ((req: FastifyRequest) => void);
    validate?: (req: FastifyRequest, rep: FastifyReply, payload: string | Buffer | Stream) => boolean;
    htmlOptions?: Options;
    jsOptions?: TerserMinifyOptions;
    cssOptions?: CSSOOptions;
    transformers?: Transformer[];
}

declare const fastifyMinify: FastifyPluginCallback<FastifyMinifyOptions>;

export default fastifyMinify;
export { fastifyMinify };
