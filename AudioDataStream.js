class AudioDataStream {

    constructor(streamURL="BAD_SOURCE", bytesExpected=NaN) {
        this.reader         = null;
        this.bytesRead      = 0;
        this.bytesExpected  = bytesExpected;
        this.closed         = false;
        this.streamURL      = streamURL;

        return Object.seal(this);
    }

    open() {
        return new Promise((reject, resolve)=> {
            let SourceReachable = true;

            // Fetch won't work on local files when running this directly
            if (location.toString().indexOf("file:///") == -1)
                SourceReachable = await fetchWithTimeout(this.streamURL, 3000, {method: "HEAD", mode: "no-cors"})
                .then(response=> response.status == "200")
                .catch(reject);

            if (!SourceReachable) {
                // JSUtils.Log("Audio track source URL not reachable: " + this.streamURL, "ERROR");
                reject("Audio track source URL not reachable: " + this.streamURL);
            }

            fetch(this.sourceURL, {cache: "no-store", mode: "same-origin", method: "GET", redirect: "error"}).then(response=> {
                this.bytesExpected = parseInt(response.headers.get("Content-Length"));
                this.reader = response.body.getReader();
                resolve();
            })
            .catch(reject);
        })
    }

    read() {
        return new Promise((reject, resolve)=> {
            if (this.closed || !this.reader) reject("Stream is closed or hasn't been opened yet");

            this.reader.read().then(({done, value})=> {
                if (!done) {
                    this.bytesRead = value.byteLength;
                    resolve(value);
                }

                this.close();
                resolve(null);
            })
            .catch(reject);
        })
    }

    close() {
        if (this.closed) return;
        this.reader.cancel();
        this.closed = true;
    }

    isDone() {
        return this.bytesRead == this.bytesExpected;
    }

    isClosed() {
        return this.closed;
    }
}

export {AudioDataStream};