# JSAudioStreamer

This repo has been through quite a journey. It started out as a prototype project for playing around with the Javascript Web Audio API. I made 3 versions back to back, each time refining it from a very a very slap-dash, spagetti hacky project to doing proper encapsulation, separation of concerns and all that

Fast forward a year later and I had been pondering making a web based music player for my own collection of mp3's (yes, I am that old...). Although I had been experimenting with making proper front-ends for my music player (see the FrenglerAmp and mFrenglerAmp repo's) I decided in the end to just build on top of this which already had the backend streaming part working.

The result is what you see here. Is it pretty? No, the UI is incredibly bare bones and ugly, and does not scale well across devices/resolutions. Is it efficient/good? Well, it works but it's probably horribly over-complicated for what it does. I personally enjoy the nitty gritty low level details of any implementation so bear that in mind.

See it for what it is: a fun hobbiest project to make a web based music player whereby some lunatic decided to code ALL parts of it himself (short of the actual audio decoding/playback). Perhaps it will be useful to someone else who wants to know about web based audio, which is why the repo is open.

Some things to keep in mind:

* Unless you are doing it for educational purposes (or some other good reason) just use the HTML Audio-tag and let it do the streaming for you.

* The audio/media API and standards are still very much in flux. Therefore the way I implemented this might  break or at least change in behaviour going forward as the standard changes and browser vendors refactor the implementations.

* It only works in Chrome at the moment. Firefox doesn't even support "audio/mpeg" mimetypes for the SourceBuffer's as of this writing. The world of web audio seems to favour MP4's over any other format, and if you want to make a serious web streaming application you should do some research first.

* The backend files CFC- and CFM-files are of course unique to my home setup, and are my take on how to fetch the datatracks and their metadata. None of my code is heuristic, and never tries to take people's connection speed into account, lowering the audio quality temporarily, which is what a lot of professional sites do 
