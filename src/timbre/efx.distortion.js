/**
 * timbre/efx.distortion
 */
"use strict";

var timbre = require("../timbre");
// __BEGIN__

var EfxDistortion = (function() {
    var EfxDistortion = function() {
        initialize.apply(this, arguments);
    }, $this = EfxDistortion.prototype;
    
    timbre.fn.setPrototypeOf.call($this, "ar-only");
    
    Object.defineProperty($this, "pre", {
        set: function(value) {
            this._.preGain = timbre(value);
        },
        get: function() { return this._.preGain; }
                        
    });
    Object.defineProperty($this, "post", {
        set: function(value) {
            this._.postGain = timbre(value);
        },
        get: function() { return this._.postGain; }
                        
    });
    Object.defineProperty($this, "freq", {
        set: function(value) {
            this._.lpfFreq = timbre(value);
        },
        get: function() { return this._.lpfFreq; }
                        
    });
    Object.defineProperty($this, "slope", {
        set: function(value) {
            this._.lpfSlope = timbre(value);
        },
        get: function() { return this._.lpfSlope; }
    });
    
    var initialize = function(_args) {
        var i, _;
        
        this._ = _ = {};
        
        i = 0;
        if (typeof _args[i] === "object" && _args[i].isKr) {
            _.preGain = _args[i++];    
        } else if (typeof _args[i] === "number") {
            _.preGain = timbre(_args[i++]);
        } else {
            _.preGain = timbre(-60);
        }
        
        if (typeof _args[i] === "object" && _args[i].isKr) {
            _.postGain = _args[i++];    
        } else if (typeof _args[i] === "number") {
            _.postGain = timbre(_args[i++]);
        } else {
            _.postGain = timbre(18);
        }
        
        if (typeof _args[i] === "object" && _args[i].isKr) {
            _.lpfFreq = _args[i++];    
        } else if (typeof _args[i] === "number") {
            _.lpfFreq = timbre(_args[i++]);
        } else {
            _.lpfFreq = timbre(2400);
        }
        
        if (typeof _args[i] === "object" && _args[i].isKr) {
            _.lpfSlope = _args[i++];    
        } else if (typeof _args[i] === "number") {
            _.lpfSlope = timbre(_args[i++]);
        } else {
            _.lpfSlope = timbre(1);
        }
        
        if (typeof _args[i] === "number") {
            _.mul = _args[i++];
        }
        if (typeof _args[i] === "number") {
            _.add = _args[i++];
        }
        this.args = timbre.fn.valist.call(this, _args.slice(i));
        
        _.prev_preGain  = undefined;
        _.prev_postGain = undefined;
        _.prev_lpfFreq  = undefined;
        _.prev_lpfSlope = undefined;
        _.in1 = _.in2 = _.out1 = _.out2 = 0;
        _.a1  = _.a2  = 0;
        _.b0  = _.b1  = _.b2 = 0;
        _.ison = true;
    };
    
    $this.clone = function(deep) {
        var newone, _ = this._;
        var args, i, imax;
        newone = timbre("efx.dist",
                        _.preGain, _.postGain, _.lpfFreq, _.lpfSlope);
        timbre.fn.copy_for_clone(this, newone, deep);
        return newone;
    };
    
    var THRESHOLD = 0.0000152587890625;
    
    var set_params = function(preGain, postGain, lpfFreq, lpfSlope) {
        var _ = this._;
        var postScale, omg, cos, sin, alp, n, ia0;
        
        postScale = Math.pow(2, -postGain / 6);
        _.preScale = Math.pow(2, -preGain / 6) * postScale;
        _.limit = postScale;
        
        if (lpfFreq) {
            omg = lpfFreq * 2 * Math.PI / timbre.samplerate;
            cos = Math.cos(omg);
            sin = Math.sin(omg);
            n = 0.34657359027997264 * lpfSlope * omg / sin;
            alp = sin * (Math.exp(n) - Math.exp(-n)) * 0.5;
            ia0 = 1 / (1 + alp);
            _.a1 = -2 * cos  * ia0;
            _.a2 = (1 - alp) * ia0;
            _.b1 = (1 - cos) * ia0;
            _.b2 = _.b0 = _.b1 * 0.5;
        }
    };
    
    $this.seq = function(seq_id) {
        var _ = this._;
        var cell, args;
        var tmp, i, imax, j, jmax;
        var preGain, postGain, lpfFreq, lpfSlope;
        var preScale, limit;
        var mul, add;
        var a1, a2, b0, b1, b2;
        var in1, in2, out1, out2;
        var input, output;
        
        cell = this.cell;
        if (seq_id !== this.seq_id) {
            args = this.args.slice(0);
            for (j = jmax = cell.length; j--; ) {
                cell[j] = 0.0;
            }
            for (i = 0, imax = args.length; i < imax; ++i) {
                tmp = args[i].seq(seq_id);
                for (j = jmax; j--; ) {
                    cell[j] += tmp[j];
                }
            }
            
            // filter
            if (_.ison) {
                preGain  = _.preGain.seq(seq_id)[0];
                postGain = _.postGain.seq(seq_id)[0];
                lpfFreq  = _.lpfFreq.seq(seq_id)[0];
                lpfSlope = _.lpfSlope.seq(seq_id)[0];
                if (preGain  !== _.prev_preGain ||
                    postGain !== _.prev_postGain ||
                    lpfFreq  !== _.prev_lpfFreq  ||
                    lpfSlope !== _.prev_lpfSlope) {
                    set_params.call(this, preGain, postGain, lpfFreq, lpfSlope);    
                }
                
                preScale = _.preScale;
                limit    = _.limit;
                mul      = _.mul;
                add      = _.add;
                
                if (_.lpfFreq) {
                    a1 = _.a1; a2 = _.a2;
                    b0 = _.b0; b1 = _.b1; b2 = _.b2;
                    in1  = _.in1;  in2  = _.in2;
                    out1 = _.out1; out2 = _.out2;
                    
                    if (out1 < THRESHOLD) out2 = out1 = 0;
                    
                    for (i = 0, imax = cell.length; i < imax; ++i) {
                        input = cell[i] * preScale;
                        if (input > limit) {
                            input = limit;
                        } else if (input < -limit) {
                            input = -limit;
                        }
                        
                        output = b0 * input + b1 * in1 + b2 * in2 - a1 * out1 - a2 * out2;
                        
                        if (output > 1.0) {
                            output = 1.0;
                        } else if (output < -1.0) {
                            output = -1.0;
                        }
                        
                        in2  = in1;
                        in1  = input;
                        out2 = out1;
                        out1 = output;
                        
                        cell[i] = output * mul + add;
                    }
                    _.in1  = in1;  _.in2  = in2;
                    _.out1 = out1; _.out2 = out2;
                } else {
                    for (i = 0, imax = cell.length; i < imax; ++i) {
                        input = cell[i] * preScale;
                        if (input > limit) {
                            input = limit;
                        } else if (input < -limit) {
                            input = -limit;
                        }
                        cell[i] = input * mul + add;
                    }
                }
            }
            this.seq_id = seq_id;
        }
        return cell;
    };

    return EfxDistortion;
}());
timbre.fn.register("efx.dist", EfxDistortion);

// __END__

describe("efx.dist", function() {
    object_test(EfxDistortion, "efx.dist");
});
