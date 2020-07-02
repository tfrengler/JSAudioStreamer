export class PlayList {

    constructor(serviceLocator) {

        this.services = serviceLocator || null;
        this.events = this.services.get("events");
        this.list = [];
        this.currentIndex = 0;

        console.log("Playlist initialized" + `${this.services ? ", with services" : ""}`);
        return Object.seal(this);
    }

    add(trackIDs) {
        if (!(trackIDs instanceof Array)) return Array.from(this.list);
        console.warn("Adding to playlist: " + trackIDs.length);

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
        console.warn("Removing from playlist: " + trackIDs.length);

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
        if (this.currentIndex > -1)
            this.currentIndex = newCurrentIndex;
    }

    getCurrent() {
        return this.list[this.currentIndex];
    }

    peekNext() {
        return this.list[this.currentIndex + 1] || null;
    }

    getNext() {
        let next = this.peekNext();
        this.currentIndex++;
        return next;
    }

    peekPrevious() {
        return this.list[this.currentIndex - 1] || null;
    }

    getPrevious() {
        let previous = this.peekPrevious();
        if (this.currentIndex > -1) this.currentIndex--;
        return previous;
    }

    getAll() {
        return Array.from(this.list);
    }
}