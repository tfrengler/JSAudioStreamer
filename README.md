# JSAudioStreamer

While working on a private, hobby project to create a web-based music player to play my own music collection, I ran into some interesting challenges when it came to streaming the audio files. Long story short: although the browser handles the streaming for you automatically via the audio-element, I decided to try and figure out if I could create my own data stream/buffer system.

Short answer to that last question is: Yes, I could. First I made a very rough prototype, and then - after running into issues with the internal buffer size in various browsers - decided to expand and remake it from scratch. This repo is the result. It basically consists of two parts: the MediaController and the StreamController.

The StreamController instantiates an AudioStream and is responsible for fetching/streaming the audio data from a remote source, using http byte-range requests, in chunks.

The MediaController is responsible for the client side interaction with the media (ie. the audio track), such as playing and pausing it. And the biggest responsibility is taking the AudioStream (from the StreamController) and buffering the data in the browser's internal buffer (via the HTMLAudioElement, MediaSource and SourceBuffer API's).

he streaming controller fetches and essentially buffers/stores the entire file, without us then having to worry about keeping it in sync with the current playtime and how much audio data is in the browser's limited buffer (this varies by browser btw). 

The biggest challenges is of course having these two separated concerns and still keeping them in sync. You have to - if you care of course - account for slower (ie. mobile) connections and making sure the MediaController doesn't throw exceptions because it tries to buffer ahead but the next chunk hasn't been fetched yet over the net. 

Dealing with files bigger than the internal buffer can be approached in many ways, and is currently a bit fuzzy because you ideally want some way of removing data you've played past and buffering ahead, without overflowing the buffer. Unfortunately - although it may change - you can't keep accurate track of the internal buffer because you can't query its current size in bytes nor remove data in bytes. You can only remove data in seconds, which is not super useful, when you can only roughly guess how many bytes per second you have by dividing the audio track size by its duration. This gives you a lot of room to make errors if you try to be too generous with appending or trimming the buffer.

A list of things to keep in mind:
* This is provided "as is". It's a hobbyist learning project and is not meant as a nice and neat module you can integrate into your own project(s). It breaks encapsulation and might not be super neat or tidy in most places. You have been warned.
*Of course despite what I said above, you are more than welcome to dissect and use it wholesale or parts of it. Perhaps it will give you - or someone else - an idea of how to pull something like this off. I bet there's a million different approaches (plenty better than mine) to streaming media data.

* The audio/media API and standards are still very much in flux. This is therefore likely to break or at least change in behaviour going forward as the standard changes and browser vendors refactor the implementations.

* It only works in Chrome at the moment. Firefox doesn't even support "audio/mpeg" mimetypes for the sourceBuffer's as of this writing.

* The backend files cfm-files are of course unique to my home setup, and are what I used to fetch the datatracks and their metadata. If you end up giving this stuff a go, you'll have to wire that up yourself. The JSON-files are from the tracks I used for testing. Use your own, as long as you stick to the same markup of course.
