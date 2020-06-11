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

        this.state          = STATES.INITIAL;
        this.reader         = null;
        this.bytesRead      = 0;
        this.bytesExpected  = bytesExpected;
        this.streamURL      = streamURL;

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

                fetch(this.streamURL, {cache: "no-store", mode: "same-origin", method: "GET", redirect: "error"}).then(response=> {
                    
                    this.bytesExpected = parseInt(response.headers.get("Content-Length"));
                    if (!this.bytesExpected) {
                        this.state = STATES.ERROR;
                        this.events.manager.trigger(this.events.types.ERROR, {error_message: "DataSource: no content-length header in response"});
                        
                        reject("DataSource: no content-length header in response");
                        return;
                    }

                    this.reader = response.body.getReader();
                    this.state = STATES.OPEN;
                    this.events.manager.trigger(this.events.types.DATA_STREAM_OPEN);

                    resolve();
                })
                .catch(error=> {
                    this.state = STATES.ERROR;
                    this.events.manager.trigger(this.events.types.ERROR, {error_message: "DataStream: error during fetch"});
                    
                    reject(error);
                });
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

    read() {
        return new Promise((resolve, reject)=> {
            if (this.state !== STATES.OPEN) {
                reject("Stream is closed, not open or in the process of being read");
                return;
            }

            this.state = STATES.READING;
            this.events.manager.trigger(this.events.types.DATA_STREAM_READING);

            this.reader.read().then(({done, value})=> {
                if (done)
                    this.close();
                else {
                    this.state = STATES.OPEN;
                    this.events.manager.trigger(this.events.types.DATA_STREAM_OPEN);
                }

                if (value) {
                    this.bytesRead += value.byteLength;
                    this.events.manager.trigger(
                        this.events.types.DATA_STREAM_CHUNK_RECEIVED,
                        {bytes_read: value.byteLength, bytes_total: this.bytesRead}
                    );
                }

                resolve({done, value});
            })
            .catch(error=> {
                this.state = STATES.ERROR;
                this.events.manager.trigger(this.events.types.ERROR, {error_message: "DataStream: error reading from stream-reader"});
                reject(error)
            });
        })
    }

    close() {
        if (this.state === STATES.CLOSED) return;

        if (this.reader) this.reader.cancel();
        this.reader = null;

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