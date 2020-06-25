import {JSUtils} from "./Utils.js";

const STATES = Object.freeze({
    "INITIAL": Symbol("INITIAL"),
    "OPEN": Symbol("OPEN"),
    "CLOSED": Symbol("CLOSED"),
    "ERROR": Symbol("ERROR"),
    "READING": Symbol("READING")
});

class DataStream {

    constructor(streamURL, bytesExpected, events) {

        this.events         = events;

        this.chunkSize      = 64 * 1024;
        this.state          = STATES.INITIAL;
        this.bytesRead      = 0;
        this.bytesExpected  = bytesExpected;
        this.streamURL      = streamURL;
        this.readInterval   = 500;
        this.lastRead       = 0;

        if (!streamURL || !bytesExpected) 
            throw new Error("Argument streamURL or bytesExpected is not defined");
        
        return Object.seal(this);
    }

    open() {
        return new Promise((resolve, reject)=> {
            if (this.state !== STATES.INITIAL) {
                reject("DataSource: unable to open data stream because we are beyond the initial state");
                return;
            }

            JSUtils.fetchWithTimeout(this.streamURL, 3000, {method: "HEAD", mode: "no-cors"})
            .then(response=> {
                if (response.status != "200") {
                    this.state = STATES.ERROR;
                    this.events.manager.trigger(this.events.types.ERROR, {error_message: `DataSource: stream URL not reachable (${this.streamURL}). Response: ${response.status}`});
                    
                    reject("DataSource: stream URL not reachable: " + this.streamURL);
                    return;
                }

                this.bytesExpected = parseInt(response.headers.get("Content-Length"));

                if (!this.bytesExpected) {
                    this.state = STATES.ERROR;
                    this.events.manager.trigger(this.events.types.ERROR, {error_message: "DataSource: no content-length header in response"});
                    
                    reject("DataSource: no content-length header in response");
                    return;
                }

                this.state = STATES.OPEN;
                this.events.manager.trigger(this.events.types.DATA_STREAM_OPEN);
                resolve();
            })
            .catch(error=> {
                this.state = STATES.ERROR;
                this.events.manager.trigger(this.events.types.ERROR, {error_message: "DataStream: error during fetchWithTimeout"});

                if (typeof error === typeof "" && error === "FETCH_REQUEST_TIMEOUT")
                    reject("DataSource: timed out trying to reach the stream URL: " + this.streamURL);
                else    
                    reject(error);
            });

        })
    }

    async read() {
        let difference = performance.now() - this.lastRead;
        
        if (difference < this.readInterval)
            await JSUtils.wait(this.readInterval - difference);

        return new Promise((resolve, reject)=> {

            if (this.state === STATES.CLOSED || this.isDone())
                resolve({chunk: null, done: true});

            if (this.state !== STATES.OPEN)
                reject("Stream is not open or in the process of being read");

            this.state = STATES.READING;
            this.events.manager.trigger(this.events.types.DATA_STREAM_READING);
            this.lastRead = performance.now();

            let ByteRangeFrom = this.bytesRead;
            let ByteRangeTo = this.bytesRead + this.chunkSize >= this.bytesExpected ? "" : this.bytesRead + this.chunkSize;
            let RequestHeaders = new Headers({"Range": `bytes=${ByteRangeFrom}-${ByteRangeTo}`});

            JSUtils.fetchWithTimeout(this.streamURL, 3000, {cache: "no-store", mode: "same-origin", method: "GET", redirect: "error", headers: RequestHeaders})
            .then(response=> {

                if (response.status !== 206) {
                    this.state = STATES.ERROR;
                    this.events.manager.trigger(this.events.types.ERROR, {error_message: `DataSource: stream URL did not return partial content (${this.streamURL}). Response: ${response.status}`});
                    
                    reject(`DataSource: stream URL did not return partial content (${this.streamURL}). Response: ${response.status}`);
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
                this.events.manager.trigger(this.events.types.ERROR, {error_message: "DataStream: error reading from stream"});
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

export {DataStream};