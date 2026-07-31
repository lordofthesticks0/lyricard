# lyricard
Small and configurable lyrics card generator. Overnight project to drain my monthly LLM quotas.

## Features
- Adjustable everything
- Large mode when your lyrics disproportionately takes way less space
- Defaults to Apple Music style, Spotify style toggleable
- Auto album cover import
- Auto lyrics import

## Notes
I don't really plan on improving this but I probably will if this gets enough traction lol, I might learn something from it.
If one of your songs doesn't load, blame the agy

### How it works (if you're interested)
Search function uses the iTunes API. This is like the only thing Apple gives out for free for everyone. Selecting the song queries LRCLib. It's timestamped to make the seek slider.

For the Apple Music background there's a small distortion on the album cover, and then you crank the blur to the max to hide it. In the end it's a nice blend of colours that's similar to the album cover but you can't really tell that it's the actual album cover. 
Might do some more work on improving (or I guess figuring out what GPT did lol) it.

I made this because Apple doesn't have something like this, and I really wished they do. Their TTML richsync lyrics are actually insane, but only Spotify has this natively.

...and yes I did accidentally commit the whole plan prompt, but figured it was nice for documentation anyways. No, it wasn't me who wrote it either.
If you prefer an LLM generated summary, see the [summary](SUMMARY.md).