import {JSUtils} from "./Utils.js";

const STATES = Object.freeze({
    "INITIAL": Symbol("INITIAL"),
    "OPEN": Symbol("OPEN"),
    "CLOSED": Symbol("CLOSED"),
    "ERROR": Symbol("ERROR"),
    "READING": Symbol("READING")
});

let Immutable = {
    configurable: false,
    enumerable: false,
    writable: false
};

export class DataStream {

    constructor(streamURL, bytesExpected, events) {

        this.events         = events || null;

        this.chunkSize      = 128 * 1024;
        this.readInterval   = 500;
        this.streamURL      = streamURL;
        this.bytesExpected  = bytesExpected;
        this.readTimeout    = 10000;
        this.checkTimeout   = 3000;

        this.state          = STATES.INITIAL;
        this.bytesRead      = 0;
        this.lastRead       = 0;

        if (!streamURL || !bytesExpected) 
            throw new Error("Argument streamURL or bytesExpected is not defined");

        Object.defineProperties(this, {
            chunkSize: Immutable,
            readInterval: Immutable,
            streamURL: Immutable,
            readTimeout: Immutable,
            checkTimeout: Immutable
        });
        
        return Object.seal(this);
    }

    open() { // async
        if (this.state !== STATES.INITIAL) 
            return Promise.reject(new Error(`DataStream: Attempt to re-open stream (state: ${this.state.description})`));

        return new Promise((resolve, reject)=> {
            // For some dumb-ass reason JS just auto-replaces single quotes inside the mime-type string for m4a with escaped double-quotes when the var is assigned (woot!??)
            // This fucks up the Accept-header in case of m4a's with the "codec='mp4a.40.2'"-part because fetch doesn't like it (again, no idea why...) and turns Accept into "*/*"
            JSUtils.fetchWithTimeout(this.streamURL, this.checkTimeout, {method: "HEAD", mode: "no-cors"})
            .then(response=> {
                if (response.status !== 200) {
                    this.state = STATES.ERROR;
                    reject(new Error(`DataStream: URL not reachable (${this.streamURL}, response status: ${response.status})`));
                }

                this.state = STATES.OPEN;
                this.events.manager.trigger(this.events.types.DATA_STREAM_OPEN);
                resolve();
            })
            .catch(error=> {
                this.state = STATES.ERROR;
                reject(error);
            });

        })
    }

    async read() { // async, doh
        if (this.state === STATES.CLOSED || this.isDone())
            Promise.resolve({chunk: null, done: true});

        if (this.state !== STATES.OPEN) 
            Promise.reject(new Error(`DataStream: Cannot read from stream as it is not open or in the process of being read (state: ${this.state.description})`));

        let difference = performance.now() - this.lastRead;
        
        if (difference < this.readInterval)
            await JSUtils.wait(this.readInterval - difference);

        return new Promise((resolve, reject)=> {

            this.state = STATES.READING;
            this.events.manager.trigger(this.events.types.DATA_STREAM_READING);
            this.lastRead = performance.now();

            let ByteRangeFrom = this.bytesRead;
            let ByteRangeTo = this.bytesRead + this.chunkSize >= this.bytesExpected ? "" : this.bytesRead + this.chunkSize;
            let RequestHeaders = new Headers({"Range": `bytes=${ByteRangeFrom}-${ByteRangeTo}`});

            JSUtils.fetchWithTimeout(this.streamURL, this.readTimeout, {cache: "no-store", mode: "same-origin", method: "GET", redirect: "error", headers: RequestHeaders})
            .then(response=> {

                if (response.status !== 206) {
                    this.state = STATES.ERROR;
                    reject(new Error(`DataStream: URL did not return partial content (${this.streamURL}), response: ${response.status}`));
                }

                return response.arrayBuffer();
            })
            .then(chunk=> {

                this.bytesRead += chunk.byteLength;
                let done = this.isDone();

                if (!done) {
                    this.state = STATES.OPEN;
                    this.events.manager.trigger(this.events.types.DATA_STREAM_OPEN);
                }

                this.events.manager.trigger(
                    this.events.types.DATA_STREAM_CHUNK_RECEIVED,
                    {bytes_read: chunk.byteLength, bytes_total: this.bytesRead}
                );

                resolve({chunk, done});
            })
            .catch(error=> {
                this.state = STATES.ERROR;
                reject(error);
            });
        })
    }

    close() {
        if (this.state === STATES.CLOSED) return;
        this.state = STATES.CLOSED;
        this.events.manager.trigger(this.events.types.DATA_STREAM_CLOSED);
    }

    isDone() {
        return this.bytesRead >= this.bytesExpected;
    }

    isClosed() {
        return this.state === STATES.CLOSED;
    }
}