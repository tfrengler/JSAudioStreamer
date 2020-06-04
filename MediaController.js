import {JSUtils} from "./Utils.js";
import { AudioObject } from "./AudioObject.js";

/*
    To get audio working via streaming:
    - Create an Audio-element
    - Create a MediaSource
    - Create SourceBuffer from MediaSource instance
    - Create object url from MediaSource instance
    - Set object url either on Audio-element OR
    - Create Source-element, set object url on it and then append to Audio-element
    - Call load() on Audio-element to rescan sources and select one available
*/

let Immutable = {
    configurable: false,
    enumerable: false,
    writable: false
};

class MediaController {
    
    constructor(serviceLocator) {
        // Properties
        this.services = serviceLocator || null;

        this.audioElement = new Audio();
        this.audioElement.autoplay = false;
        this.audioElement.preload = "metadata";
        this.audioElement.appendChild(document.createElement("source"));
        this.audioElement.appendChild(document.createElement("source"));

        this.CHROME_SOURCEBUFFER_LIMIT = 12582912;
        this.FIREFOX_SOURCEBUFFER_LIMIT = 15728640;
        this.EDGE_SOURCEBUFFER_LIMIT = 12582912;

        this.playCursorLastUpdated = 0;
        this.resumeWhenPlayable = true;
        this.desiredBufferHead = 120;
        this.bufferAheadTriggerTreshold = 30;
        this.unreachableSourcesLimit = 3;
        this.unreachableSources = 0;

        this.stalledInitialRecoveryTimeout = 0;
        this.stalledRetryInterval = 3000;
        this.stalledRetryMaxTimes = 3;
        this.stalledRecoverAttempts = 0;
        this.stalledInitialRecoveryAttempt = null;
        this.stalled = false;

        this.preparingNextTrack = false;
        this.currentAudioTrack = null;
        this.nextAudioTrack = null;
        this.currentSourceElement = this.audioElement.children[0];
        this.nextSourceElement = this.audioElement.children[1];

        // Object.defineProperties(this, {
        //     audioPlayer: Immutable,
        //     desiredBufferHead: Immutable,
        //     bufferAheadTriggerTreshold: Immutable,
        //     unreachableSourcesLimit: Immutable,
        //     StalledRetryInterval: Immutable,
        //     StalledRetryMaxTimes: Immutable,
        //     CHROME_SOURCEBUFFER_LIMIT: Immutable,
        //     FIREFOX_SOURCEBUFFER_LIMIT: Immutable,
        //     EDGE_SOURCEBUFFER_LIMIT: Immutable,
        //     sourceElements: Immutable,
        //     audioObjects: Immutable
        // });
    
        // Event handlers
        this.audioElement.addEventListener("loadedmetadata", this._onTrackMetadataLoaded.bind(this));
        this.audioElement.addEventListener("waiting", this._onWaiting.bind(this));
        this.audioElement.addEventListener("stalled", this._onStalled.bind(this));
        this.audioElement.addEventListener("ended", this._onTrackEnded.bind(this));
        this.audioElement.addEventListener("canplay", this._onTrackPlayable.bind(this));
        this.audioElement.addEventListener("error", this._onError.bind(this));
        this.audioElement.addEventListener("durationchange", this._onDurationChange.bind(this));
        this.audioElement.addEventListener("timeupdate", this._onPlayCursorChange.bind(this));

        console.log("MediaController initialized" + `${this.services ? ", with services" : ""}`);

        // TODO(thomas): For testing purposes
        this.playList = [
            "589AD74D5E14EC88716B7D90F89C7A93F272DC480EEA8D8BC7010EF26479F072",
            "F45B9A228ECF43A77C3EFBCDDA9C8FC62A35440944CC5B3FB692C6A6C8FB2C00",
            "E0A5C0CD65355E75BDC08751F5E81B728C48D90F71E5C8A7448B748C577A8E21",
            "9766E53DF63D4E25C620C0F587F3EDE0DEBA00773EE6E3C163553995274A0EB0",
            "DFE8C1812BA79BC066E9AA4E0887FB3AD47E00AB1E35C1597948272205535FBD",
            "2E9A1046B949E3D0D831C5860C193E210A7BE5CD723666C92BC840DEFB4F97BF",
            "996C51C8C6D40754508B240D041EFD0C11094C0924D413858475CC57A5A457DE",
            "AA5D5F240611DE23A4DB9B7119A3083565B44E8EDC12DC6A6EFD4740C4AF1332",
            "44D5ECC40E357E7C268506636C15C42164B926E39F26FFD6DB278382C127A587",
            "4A294EA6E567F263449CED90535C56D176F8723A0BD9540F9840D9B20A49C380",
            "3457A56799540A1253CC808793CCA0CC8BF59C3DFE1067817810868D7E99127B",
            "B0931E9BF63171D89B1D986FC9464649D17B76C7B6753834130AEEC686F67294",
            "FBB6FBC6A02A2106B6D01D528774B59111E7912D0157DA3936CEF96A98C14805"
        ];
    }

    // PUBLIC
    play() {
        if (!this.currentAudioTrack) return;
        if (!this.audioElement.paused) return;

        this.audioElement.play().then(()=> {
            JSUtils.Log("Playback started");
        })
        .catch(error=> this._onError(error));
    }

    pause() {
        this.audioElement.pause();
    }

    mute() {
        this.audioElement.muted = !this.audioElement.muted;
    }

    setVolume(volume) {
        this.audioElement.volume = volume || 1.0;
    }

    loadNextTrack(trackID, load) {
        const TrackData = this.services.get("indexes").MasterAudioTrackIndex[trackID];
        const BackendData = this.services.get("indexes").BackendIndex[trackID]; // TODO(thomas): Needs to be taken out eventually

        let nextAudioTrack = new AudioObject(
            `Data\\Music\\${BackendData.RelativePath}\\${BackendData.FileName}`, // TODO(thomas): Needs to be reworked to a cfm-url
            TrackData.Mimetype,
            TrackData.Size,
            TrackData.Duration
        );

        nextAudioTrack.ready().then(objectURL=> {
            // So apparently appending a source-element to an audio-element triggers load() if there are no current sources selected...
            // Thus we are going to have two source-elements that we'll swap between, similar to the audio objects
            // Maybe it's still possible to utilize appendChild if we set the src-attrib AFTER appending?
            this.nextSourceElement.dataset.trackid = trackID;
            this.nextSourceElement.src = objectURL;
            this.nextAudioTrack = nextAudioTrack;

            // setTimeout(()=> nextAudioTrack.bufferUntil(3), 100);
            
            if (load === true) 
                this._rotateTrack();
        })
        .catch(error=> {
            nextAudioTrack.dispose();
            this.nextAudioTrack = null;

            console.warn("loadNextTrack errored:");
            console.error(error);
        })
    }

    // PRIVATE
    _rotateTrack() {
        if (this.currentAudioTrack) this.currentAudioTrack.dispose();

        this.currentAudioTrack = this.nextAudioTrack;
        this.nextAudioTrack = null;
    
        let previousSourceElement = this.currentSourceElement;
        previousSourceElement.src = "";

        this.currentSourceElement = this.nextSourceElement;
        this.nextSourceElement = previousSourceElement;

        // Loads triggers the "timeupdate"-event if currentTime is above 0, because it moves the cursor back to 0 again
        this.audioElement.load();
        // setTimeout(()=> this.currentAudioTrack.bufferUntil(this.desiredBufferHead), 100);
        this.preparingNextTrack = false;
    }

    _prepareNextTrack() {
        let nextTrackID = this.playList.shift();
        if (nextTrackID) 
            this.loadNextTrack(nextTrackID, true);
        else 
            JSUtils.Log("Playlist empty");
        /*
            - Get next track from... wherever (service?)
            - Call loadNextTrack with load=false
        */
    }

    _onTrackEnded() {
        JSUtils.Log(`Playback ended`);
        if (this.nextAudioTrack) this._rotateTrack();
    }

    _onTrackPlayable() {
        JSUtils.Log("Enough audio frames to start playback");
        
        // if (this.resumeWhenPlayable) {
        //     JSUtils.Log("Playback resuming");
        //     this.play()
        // }
    }

    _onError(error) {
        // if (this.audioElement.error.name === "QuotaExceededError")
            // JSUtils.Log("SourceBuffer overflowed", "ERROR");
        
        JSUtils.Log(error || this.audioElement.error, "ERROR");
        // Perhaps consider a way to ensure that the 2 minutes of data we buffer ahead doesn't overflow the buffer? Unlikely, but still
    }

    _onDurationChange() {
        if (this.audioElement.duration === Infinity) return;
        JSUtils.Log("Duration known");
    }

    _onPlayCursorChange() {
        if ((performance.now() - this.playCursorLastUpdated) < 950)
            return;

        this.playCursorLastUpdated = performance.now();

        if (!this.preparingNextTrack && (this.audioElement.duration - this.audioElement.currentTime || 999) <= 5) {
            this.preparingNextTrack = true;
            this._prepareNextTrack();
        }

        if (this.currentAudioTrack && this.currentAudioTrack.isBusy()) return;
        
        // if (this.audioElement.buffered.length && this.audioElement.buffered.end(0) - this.audioElement.currentTime < this.bufferAheadTriggerTreshold)
        //     this.currentAudioTrack.bufferUntil(this.audioElement.buffered.end(0) + this.desiredBufferHead || 9999);
    }

    _onTrackMetadataLoaded() {
        JSUtils.Log(`Metadata loaded`);
    }

    _onWaiting() {
        JSUtils.Log("Playback stopped - lack of data from source. This may be temporary (latency, seeking)", "WARNING")
    }

    _onStalled() {
        JSUtils.Log("Streaming data from media source has stalled", "ERROR");
    }

}

export {MediaController};