import { JSUtils } from "./Utils.js";

export class PlayList {

    constructor(serviceLocator) {

        this.services = serviceLocator || null;
        this.events = this.services.get("events") || Object.freeze({manager: {trigger() {console.warn("PLAYLIST EVENTS: No event service provided")}}, types: {}});
        this.list = [];
        this.currentIndex = 0;
        this.beforeShuffleList = [];

        console.log("Playlist initialized");
        return Object.seal(this);
    }

    add(trackIDs) {
        if (!(trackIDs instanceof Array)) return Array.from(this.list);
        if (window.DevMode) console.warn("Adding to playlist: " + trackIDs.length);

        trackIDs.forEach(trackID=> {
            if (this.list.indexOf(trackID) === -1) this.list.push(trackID);
        });
        let newList = Array.from(this.list);
        this.events.manager.trigger(this.events.types.PLAYLIST_TRACKS_ADDED, {list: newList, added: trackIDs});

        localStorage.setItem("playlist", newList.join("|"));
        return newList;
    }

    remove(trackIDs) {
        if (!(trackIDs instanceof Array)) return Array.from(this.list);
        if (window.DevMode) console.warn("Removing from playlist: " + trackIDs.length);

        let current = this.getCurrent();
        this.list = this.list.filter(trackID=> trackIDs.indexOf(trackID) === -1);
        this.currentIndex = this.list.indexOf(current);

        if (this.currentIndex < 0) this.currentIndex = 0; // If the currently selected entry is removed, set to the first entry in the list
        let newList = Array.from(this.list);
        this.events.manager.trigger(this.events.types.PLAYLIST_TRACKS_REMOVED, {list: newList, removed: trackIDs});

        localStorage.setItem("playlist", newList.join("|"));
        return newList;
    }

    clear() {
        this.list = [];
        this.currentIndex = 0;
        localStorage.setItem("playlist", "");
    }

    count() {
        return this.list.length;
    }

    setCurrent(trackID) {
        let newCurrentIndex = this.list.indexOf(trackID);
        if (this.currentIndex > -1) {
            this.currentIndex = newCurrentIndex;
            localStorage.setItem("currentTrack", trackID);
        }
    }

    getCurrent() {
        return this.list[this.currentIndex];
    }

    peekNext() {
        return this.list[this.currentIndex + 1] || null;
    }

    getNext() {
        if (this.randomize) return this.getRandom();

        let next = this.peekNext();
        this.currentIndex++;
        localStorage.setItem("currentTrack", this.list[this.currentIndex]);

        return next;
    }

    peekPrevious() {
        return this.list[this.currentIndex - 1] || null;
    }

    getPrevious() {
        if (this.randomize) return this.getRandom();

        let previous = this.peekPrevious();
        if (this.currentIndex > -1) {
            this.currentIndex--;
            localStorage.setItem("currentTrack", this.list[this.currentIndex]);
        }

        return previous;
    }

    getAll() {
        return Array.from(this.list);
    }

    shuffle(enable)
    {
        if (enable)
        {
            this.beforeShuffleList = JSUtils.deepClone(this.list);
            JSUtils.shuffleArray(this.list);

            this.events.manager.trigger(this.events.types.PLAYLIST_SHUFFLED, {list: this.list});
            return;
        }

        this.list = this.beforeShuffleList;
        this.beforeShuffleList = null;
        this.events.manager.trigger(this.events.types.PLAYLIST_SHUFFLED, {list: this.list});
    }
}