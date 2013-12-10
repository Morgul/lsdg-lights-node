//----------------------------------------------------------------------------------------------------------------------
// A simple configuration file. To add a configuration key, do so in the module.exports object.
//
// @module config.js
//----------------------------------------------------------------------------------------------------------------------

function get(key, defaultValue)
{
    if(key in module.exports)
    {
        return module.exports[key];
    } // end if

    return defaultValue;
} // end get

//----------------------------------------------------------------------------------------------------------------------

module.exports = {

    // A simple get function that works like python's dictionary 'get'
    get: get,

    // Should be a valid path to the root folder containing music. We search recursively for all `.mp3` files that have
    // valid .json files of the same name. If you need to generate metadata, run `./scripts/buildMetadata.py`.
    musicDir: "./music",

    // URL to connect to the light controller website at.
    lightSite: "http://lights.lsdg.org:8080/rpi",

    // Default thresholds
    defaultThresholds: [
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1
    ],

    serialPort: process.env.LSDG_LIGHTS_SERIAL || "/dev/ttyACM0",
    serialBaudrate: 115200
}; // end exports

//----------------------------------------------------------------------------------------------------------------------
