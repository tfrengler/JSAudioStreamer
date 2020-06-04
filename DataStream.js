import {JSUtils} from "./Utils.js";

const STATES = Object.freeze({
    "INITIAL": Symbol("INITIAL"),
    "OPEN": Symbol("OPEN"),
    "CLOSED": Symbol("CLOSED"),
    "ERROR": Symbol("ERROR"),
    "READING": Symbol("READING")
});

class DataStream {

    constructor(streamURL="BAD_SOURCE", bytesExpected=NaN) {
        this.state          = STATES.INITIAL;
        this.reader         = null;
        this.bytesRead      = 0;
        this.bytesExpected  = bytesExpected;
        this.streamURL      = streamURL;

        if (!streamURL || !bytesExpected) throw new Error("Argument streamURL or bytesExpected is not defined");
        return Object.seal(this);
    }

    open() {
        return new Promise((resolve, reject)=> {

            JSUtils.fetchWithTimeout(this.streamURL, 3000, {method: "HEAD", mode: "no-cors"})
            .then(response=> {
                if (response.status != "200")
                    reject("DataSource stream URL not reachable: " + this.streamURL);

                fetch(this.streamURL, {cache: "no-store", mode: "same-origin", method: "GET", redirect: "error"}).then(response=> {
                    this.bytesExpected = parseInt(response.headers.get("Content-Length"));
                    this.reader = response.body.getReader();
                    this.state = STATES.OPEN;

                    resolve();
                })
                .catch(error=> {
                    this.state = STATES.ERROR;
                    reject(error);
                });
            })
            .catch(error=> {
                this.state = STATES.ERROR;

                if (typeof error === typeof "" && error === "FETCH_REQUEST_TIMEOUT")
                    reject("DataSource stream URL timed out: " + this.streamURL);
                else    
                    reject(error);
            });

        })
    }

    read() {
        return new Promise((resolve, reject)=> {
            if (this.state !== STATES.OPEN) reject("Stream is closed, not open or in the process of being read");

            this.state = STATES.READING;

            this.reader.read().then(({done, value})=> {
                if (done)
                    this.close();
                else
                    this.state = STATES.OPEN;

                if (value) this.bytesRead += value.byteLength;
                resolve({done, value});
            })
            .catch(error=> reject(error));
        })
    }

    close() {
        if (this.state === STATES.CLOSED) return;
        if (this.reader) this.reader.cancel();
        this.state = STATES.CLOSED;
    }

    isDone() {
        return this.bytesRead >= this.bytesExpected;
    }

    isClosed() {
        return this.state === STATES.CLOSED;
    }
}

export {DataStream};