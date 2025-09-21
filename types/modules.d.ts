declare module 'bcrypt' {
  export function hash(data: string | Buffer, saltOrRounds: string | number): Promise<string>;
  export function hashSync(data: string | Buffer, saltOrRounds: string | number): string;
  export function compare(data: string | Buffer, encrypted: string): Promise<boolean>;
  export function compareSync(data: string | Buffer, encrypted: string): boolean;
  export function genSalt(rounds?: number): Promise<string>;
  export function genSaltSync(rounds?: number): string;
}

declare module 'jsonwebtoken' {
  export interface SignOptions {
    expiresIn?: string | number;
    algorithm?: string;
    [key: string]: any;
  }
  
  export interface VerifyOptions {
    algorithms?: string[];
    [key: string]: any;
  }
  
  export function sign(payload: object, secretOrPrivateKey: string, options?: SignOptions): string;
  export function verify(token: string, secretOrPublicKey: string, options?: VerifyOptions): any;
  export function decode(token: string): any;
}

declare module 'multer' {
  import { RequestHandler } from 'express';
  
  interface StorageEngine {
    _handleFile(req: Express.Request, file: Express.Multer.File, cb: (error?: any, info?: Partial<Express.Multer.File>) => void): void;
    _removeFile(req: Express.Request, file: Express.Multer.File, cb: (error: Error | null) => void): void;
  }
  
  interface Options {
    storage?: StorageEngine;
    fileFilter?: (req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback) => void;
    limits?: {
      fileSize?: number;
      files?: number;
      [key: string]: any;
    };
  }
  
  type FileFilterCallback = (error: Error | null, acceptFile?: boolean) => void;
  
  function multer(options?: Options): {
    single(fieldname: string): RequestHandler;
    array(fieldname: string, maxCount?: number): RequestHandler;
    fields(fields: Array<{ name: string; maxCount?: number }>): RequestHandler;
    none(): RequestHandler;
    any(): RequestHandler;
  };
  
  namespace multer {
    function memoryStorage(): StorageEngine;
    function diskStorage(options: any): StorageEngine;
  }
  
  export = multer;
}

declare module 'compression' {
  import { RequestHandler } from 'express';
  
  interface CompressionOptions {
    filter?: (req: any, res: any) => boolean;
    level?: number;
    threshold?: number;
    [key: string]: any;
  }
  
  function compression(options?: CompressionOptions): RequestHandler;
  namespace compression {
    function filter(req: any, res: any): boolean;
  }
  
  export = compression;
}