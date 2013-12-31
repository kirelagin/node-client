// Generated by IcedCoffeeScript 1.6.3-j
(function() {
  var E, ST, TrackSubSubCommand, TrackWrapper, User, colors, constants, db, deq, env, iced, log, make_esc, prompt_yn, proof_type_to_string, proofs, session, unix_time, util, __iced_k, __iced_k_noop;

  iced = require('iced-coffee-script/lib/coffee-script/iced').runtime;
  __iced_k = __iced_k_noop = function() {};

  db = require('./db').db;

  constants = require('./constants').constants;

  log = require('./log');

  proofs = require('keybase-proofs');

  proof_type_to_string = proofs.proof_type_to_string;

  ST = constants.signature_types;

  deq = require('deep-equal');

  E = require('./err').E;

  unix_time = require('pgp-utils').util.unix_time;

  make_esc = require('iced-error').make_esc;

  prompt_yn = require('./prompter').prompt_yn;

  colors = require('colors');

  session = require('./session').session;

  User = require('./user').User;

  db = require('./db');

  util = require('util');

  env = require('./env').env;

  exports.TrackWrapper = TrackWrapper = (function() {
    function TrackWrapper(_arg) {
      this.trackee = _arg.trackee, this.tracker = _arg.tracker, this.local = _arg.local, this.remote = _arg.remote;
      this.uid = this.trackee.id;
      this.sig_chain = this.trackee.sig_chain;
    }

    TrackWrapper.prototype.last = function() {
      return this.sig_chain.last();
    };

    TrackWrapper.prototype.table = function() {
      return this.sig_chain.table[ST.REMOTE_PROOF];
    };

    TrackWrapper.prototype._check_remote_proof = function(rp) {
      var a, b, link, rkp, _ref, _ref1;
      if ((rkp = rp.remote_key_proof) == null) {
        return new E.RemoteProofError("no 'remote_key_proof field'");
      } else if ((a = (_ref = rkp.check_data_json) != null ? _ref.name : void 0) !== (b = proof_type_to_string[rkp.proof_type])) {
        return new E.RemoteProofError("name mismatch: " + a + " != " + b);
      } else if ((link = this.sig_chain.lookup(rp.curr)) == null) {
        return new E.RemoteProofError("Failed to find a chain link for " + rp.curr);
      } else if (!deq((a = (_ref1 = link.body()) != null ? _ref1.service : void 0), (b = rkp.check_data_json))) {
        log.info("JSON obj mismatch: " + (JSON.stringify(a)) + " != " + (JSON.stringify(b)));
        return new E.RemoteProofError("The check data was wrong for the signature");
      } else {
        return null;
      }
    };

    TrackWrapper.prototype._check_track_obj = function(o) {
      var a, b, err, rp, _i, _len, _ref, _ref1;
      err = null;
      if ((a = o.id) !== (b = this.trackee.id)) {
        err = new E.UidMismatchError("" + a + " != " + b);
      } else if ((a = (_ref = o.basics) != null ? _ref.username : void 0) !== (b = this.trackee.username())) {
        err = new E.UsernameMismatchError("" + a + " != " + b);
      } else {
        _ref1 = o.remote_proofs;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          rp = _ref1[_i];
          if (err == null) {
            err = this._check_remote_proof(rp);
          }
        }
      }
      return err;
    };

    TrackWrapper.prototype._skip_remote_check = function(which) {
      var a, b, last, last_check, prob, ret, rpri, track_cert, _check_all_proofs_ok, _ref;
      track_cert = this[which];
      log.debug("+ _skip_remote_check for " + which);
      rpri = constants.time.remote_proof_recheck_interval;
      _check_all_proofs_ok = function(proofs) {
        var proof, _i, _len, _ref;
        for (_i = 0, _len = proofs.length; _i < _len; _i++) {
          proof = proofs[_i];
          if (((_ref = proof.remote_key_proof) != null ? _ref.state : void 0) !== 1) {
            return false;
          }
        }
        return true;
      };
      prob = track_cert == null ? "no track cert given" : (last = this.last()) == null ? "no last link found" : (last_check = track_cert.ctime) != null ? "no last_check" : unix_time() - last_check > rpri ? "timed out!" : (a = (_ref = track_cert.seq_tail) != null ? _ref.payload_hash : void 0) !== (b = last.id) ? "id/hash mismatch: " + a + " != " + b : !(_check_all_proofs_ok(track_cert.remote_proofs)) ? "all proofs were not OK" : void 0;
      ret = prob != null ? (log.debug("| problem: " + prob), false) : true;
      log.debug("- _skip_remote_check -> " + ret);
      return ret;
    };

    TrackWrapper.prototype._skip_approval = function(which) {
      var a, b, dlen, prob, ret, rkp, rp, tmp, track_cert;
      track_cert = this[which];
      log.debug("+ skip_approval(" + which + ")");
      dlen = function(d) {
        return Object.keys(d).length;
      };
      prob = (function() {
        var _i, _len, _ref, _ref1, _ref2, _ref3;
        if (track_cert == null) {
          return "no cert found";
        } else if ((a = (_ref = track_cert.key) != null ? _ref.key_fingerprint : void 0) !== (b = this.trackee.fingerprint())) {
          return "trackee changed keys: " + a + " != " + b;
        } else if ((a = track_cert.remote_proofs.length) !== (b = dlen(this.table()))) {
          return "number of remote IDs changed: " + a + " != " + b;
        } else {
          tmp = null;
          _ref1 = track_cert.remote_proofs;
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            rp = _ref1[_i];
            rkp = rp.remote_key_proof;
            if (!deq((a = rkp.check_data_json), (b = (_ref2 = this.table()[rkp.proof_type]) != null ? (_ref3 = _ref2.body()) != null ? _ref3.service : void 0 : void 0))) {
              tmp = "Remote ID changed: " + (JSON.stringify(a)) + " != " + (JSON.stringify(b));
              break;
            }
          }
          return tmp;
        }
      }).call(this);
      ret = true;
      if (prob != null) {
        log.debug("| failure: " + prob);
        ret = false;
      }
      log.debug("- skip_approval(" + which + ") -> " + ret);
      return ret;
    };

    TrackWrapper.prototype.skip_remote_check = function() {
      if (this._skip_remote_check('remote')) {
        return constants.skip.REMOTE;
      } else if (this._skip_remote_check('local')) {
        return constants.skip.LOCAL;
      } else {
        return constants.skip.NONE;
      }
    };

    TrackWrapper.prototype.skip_approval = function() {
      if (this._skip_approval('remote')) {
        return constants.skip.REMOTE;
      } else if (this._skip_approval('local')) {
        return constants.skip.LOCAL;
      } else {
        return constants.skip.NONE;
      }
    };

    TrackWrapper.prototype.load_local = function(cb) {
      var err, value, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      log.debug("+ getting local tracking info from DB");
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/home/max/src/keybase-node-client/src/track.iced",
            funcname: "TrackWrapper.load_local"
          });
          db.get({
            type: constants.ids.local_track,
            key: _this.uid
          }, __iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                err = arguments[0];
                return value = arguments[1];
              };
            })(),
            lineno: 141
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          _this.local = value;
          log.debug("- completed, with result: " + (!!value));
          return cb(err);
        };
      })(this));
    };

    TrackWrapper.prototype.store_local = function(cb) {
      var err, type, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      log.debug("+ storing local track object");
      type = constants.ids.local_track;
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/home/max/src/keybase-node-client/src/track.iced",
            funcname: "TrackWrapper.store_local"
          });
          db.put({
            type: type,
            key: _this.uid,
            value: _this.track_obj
          }, __iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                return err = arguments[0];
              };
            })(),
            lineno: 151
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          log.debug("- stored local track object");
          return cb(err);
        };
      })(this));
    };

    TrackWrapper.prototype.check = function() {
      var e;
      if (this.local) {
        if ((e = this._check_track_obj(this.local)) != null) {
          log.warn("Local tracking object was invalid: " + e.message);
          this.local = null;
        } else {
          log.debug("| local track checked out");
        }
      }
      if (this.remote != null) {
        if ((e = this._check_track_obj(this.remote)) != null) {
          log.warn("Remote tracking object was invalid: " + e.message);
          return this.remote = null;
        } else {
          return log.debug("| remote track checked out");
        }
      }
    };

    TrackWrapper.load = function(_arg, cb) {
      var err, remote, track, trackee, tracker, uid, ___iced_passed_deferral, __iced_deferrals, __iced_k, _ref;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      tracker = _arg.tracker, trackee = _arg.trackee;
      uid = trackee.id;
      remote = tracker != null ? (_ref = tracker.sig_chain) != null ? _ref.get_track_obj(uid) : void 0 : void 0;
      log.debug("+ loading Tracking info w/ remote=" + (!!remote));
      track = new TrackWrapper({
        uid: uid,
        trackee: trackee,
        tracker: tracker,
        remote: remote
      });
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/home/max/src/keybase-node-client/src/track.iced",
            funcname: "TrackWrapper.load"
          });
          track.load_local(__iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                return err = arguments[0];
              };
            })(),
            lineno: 178
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          if (typeof err !== "undefined" && err !== null) {
            track = null;
          }
          if (track != null) {
            track.check();
          }
          log.debug("- loaded tracking info");
          return cb(err, track);
        };
      })(this));
    };

    TrackWrapper.prototype.is_tracking = function() {
      return !!this.remote;
    };

    TrackWrapper.prototype.store_remote = function(cb) {
      var err, g, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/home/max/src/keybase-node-client/src/track.iced",
            funcname: "TrackWrapper.store_remote"
          });
          _this.tracker.gen_track_proof_gen({
            uid: _this.uid,
            track_obj: _this.track_obj
          }, __iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                err = arguments[0];
                return g = arguments[1];
              };
            })(),
            lineno: 191
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          (function(__iced_k) {
            if (typeof err === "undefined" || err === null) {
              (function(__iced_k) {
                __iced_deferrals = new iced.Deferrals(__iced_k, {
                  parent: ___iced_passed_deferral,
                  filename: "/home/max/src/keybase-node-client/src/track.iced",
                  funcname: "TrackWrapper.store_remote"
                });
                g.run(__iced_deferrals.defer({
                  assign_fn: (function() {
                    return function() {
                      return err = arguments[0];
                    };
                  })(),
                  lineno: 192
                }));
                __iced_deferrals._fulfill();
              })(__iced_k);
            } else {
              return __iced_k();
            }
          })(function() {
            return cb(err);
          });
        };
      })(this));
    };

    TrackWrapper.prototype.store_track = function(_arg, cb) {
      var do_remote, esc, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      do_remote = _arg.do_remote;
      esc = make_esc(cb, "TrackWrapper::store_track");
      log.debug("+ track user (remote=" + do_remote + ")");
      this.track_obj = this.trackee.gen_track_obj();
      log.debug("| object generated: " + (JSON.stringify(this.track_obj)));
      (function(_this) {
        return (function(__iced_k) {
          if (do_remote) {
            (function(__iced_k) {
              __iced_deferrals = new iced.Deferrals(__iced_k, {
                parent: ___iced_passed_deferral,
                filename: "/home/max/src/keybase-node-client/src/track.iced",
                funcname: "TrackWrapper.store_track"
              });
              _this.store_remote(esc(__iced_deferrals.defer({
                lineno: 203
              })));
              __iced_deferrals._fulfill();
            })(__iced_k);
          } else {
            (function(__iced_k) {
              __iced_deferrals = new iced.Deferrals(__iced_k, {
                parent: ___iced_passed_deferral,
                filename: "/home/max/src/keybase-node-client/src/track.iced",
                funcname: "TrackWrapper.store_track"
              });
              _this.store_local(esc(__iced_deferrals.defer({
                lineno: 205
              })));
              __iced_deferrals._fulfill();
            })(__iced_k);
          }
        });
      })(this)((function(_this) {
        return function() {
          log.debug("- tracked user");
          return cb(null);
        };
      })(this));
    };

    return TrackWrapper;

  })();

  exports.TrackSubSubCommand = TrackSubSubCommand = (function() {
    function TrackSubSubCommand(_arg) {
      this.args = _arg.args, this.opts = _arg.opts;
    }

    TrackSubSubCommand.prototype.prompt_ok = function(warnings, cb) {
      var err, prompt, ret, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      prompt = warnings ? (log.console.log(colors.red("Some remote proofs failed!")), "Still verify this user?") : "Are you satisfied with these proofs?";
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/home/max/src/keybase-node-client/src/track.iced",
            funcname: "TrackSubSubCommand.prompt_ok"
          });
          prompt_yn({
            prompt: prompt,
            defval: false
          }, __iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                err = arguments[0];
                return ret = arguments[1];
              };
            })(),
            lineno: 225
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          return cb(err, ret);
        };
      })(this));
    };

    TrackSubSubCommand.prototype.prompt_track = function(cb) {
      var err, prompt, ret, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      ret = err = null;
      (function(_this) {
        return (function(__iced_k) {
          if (_this.opts.remote) {
            return __iced_k(ret = true);
          } else {
            (function(__iced_k) {
              if (_this.opts.batch || _this.opts.local) {
                return __iced_k(ret = false);
              } else {
                prompt = "Permnanently track this user, and write proof to server?";
                (function(__iced_k) {
                  __iced_deferrals = new iced.Deferrals(__iced_k, {
                    parent: ___iced_passed_deferral,
                    filename: "/home/max/src/keybase-node-client/src/track.iced",
                    funcname: "TrackSubSubCommand.prompt_track"
                  });
                  prompt_yn({
                    prompt: prompt,
                    defval: true
                  }, __iced_deferrals.defer({
                    assign_fn: (function() {
                      return function() {
                        err = arguments[0];
                        return ret = arguments[1];
                      };
                    })(),
                    lineno: 236
                  }));
                  __iced_deferrals._fulfill();
                })(__iced_k);
              }
            })(__iced_k);
          }
        });
      })(this)((function(_this) {
        return function() {
          return cb(err, ret);
        };
      })(this));
    };

    TrackSubSubCommand.prototype.run = function(cb) {
      var accept, err, esc, found, me, them, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      esc = make_esc(cb, "Verify::run");
      log.debug("+ run");
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/home/max/src/keybase-node-client/src/track.iced",
            funcname: "TrackSubSubCommand.run"
          });
          User.load_me(esc(__iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                return me = arguments[0];
              };
            })(),
            lineno: 245
          })));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          (function(__iced_k) {
            __iced_deferrals = new iced.Deferrals(__iced_k, {
              parent: ___iced_passed_deferral,
              filename: "/home/max/src/keybase-node-client/src/track.iced",
              funcname: "TrackSubSubCommand.run"
            });
            User.load({
              username: _this.args.them
            }, esc(__iced_deferrals.defer({
              assign_fn: (function() {
                return function() {
                  return them = arguments[0];
                };
              })(),
              lineno: 247
            })));
            __iced_deferrals._fulfill();
          })(function() {
            (function(__iced_k) {
              __iced_deferrals = new iced.Deferrals(__iced_k, {
                parent: ___iced_passed_deferral,
                filename: "/home/max/src/keybase-node-client/src/track.iced",
                funcname: "TrackSubSubCommand.run"
              });
              them.import_public_key(esc(__iced_deferrals.defer({
                assign_fn: (function() {
                  return function() {
                    return found = arguments[0];
                  };
                })(),
                lineno: 248
              })));
              __iced_deferrals._fulfill();
            })(function() {
              (function(__iced_k) {
                __iced_deferrals = new iced.Deferrals(__iced_k, {
                  parent: ___iced_passed_deferral,
                  filename: "/home/max/src/keybase-node-client/src/track.iced",
                  funcname: "TrackSubSubCommand.run"
                });
                _this._run2({
                  me: me,
                  them: them
                }, __iced_deferrals.defer({
                  assign_fn: (function() {
                    return function() {
                      err = arguments[0];
                      return accept = arguments[1];
                    };
                  })(),
                  lineno: 252
                }));
                __iced_deferrals._fulfill();
              })(function() {
                (function(__iced_k) {
                  if (accept) {
                    log.debug("| commit_key");
                    (function(__iced_k) {
                      __iced_deferrals = new iced.Deferrals(__iced_k, {
                        parent: ___iced_passed_deferral,
                        filename: "/home/max/src/keybase-node-client/src/track.iced",
                        funcname: "TrackSubSubCommand.run"
                      });
                      them.commit_key(esc(__iced_deferrals.defer({
                        lineno: 256
                      })));
                      __iced_deferrals._fulfill();
                    })(__iced_k);
                  } else {
                    (function(__iced_k) {
                      if (!found) {
                        log.debug("| remove_key");
                        (function(__iced_k) {
                          __iced_deferrals = new iced.Deferrals(__iced_k, {
                            parent: ___iced_passed_deferral,
                            filename: "/home/max/src/keybase-node-client/src/track.iced",
                            funcname: "TrackSubSubCommand.run"
                          });
                          them.remove_key(esc(__iced_deferrals.defer({
                            lineno: 259
                          })));
                          __iced_deferrals._fulfill();
                        })(__iced_k);
                      } else {
                        return __iced_k();
                      }
                    })(__iced_k);
                  }
                })(function() {
                  log.debug("- run");
                  return cb(err);
                });
              });
            });
          });
        };
      })(this));
    };

    TrackSubSubCommand.prototype._run2 = function(_arg, cb) {
      var accept, approve, check, do_remote, err, esc, me, n_warnings, skp, them, trackw, warnings, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      me = _arg.me, them = _arg.them;
      esc = make_esc(cb, "Verify::_run2");
      log.debug("+ _run2");
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "/home/max/src/keybase-node-client/src/track.iced",
            funcname: "TrackSubSubCommand._run2"
          });
          them.verify(esc(__iced_deferrals.defer({
            lineno: 270
          })));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          (function(__iced_k) {
            __iced_deferrals = new iced.Deferrals(__iced_k, {
              parent: ___iced_passed_deferral,
              filename: "/home/max/src/keybase-node-client/src/track.iced",
              funcname: "TrackSubSubCommand._run2"
            });
            TrackWrapper.load({
              tracker: me,
              trackee: them
            }, esc(__iced_deferrals.defer({
              assign_fn: (function() {
                return function() {
                  return trackw = arguments[0];
                };
              })(),
              lineno: 271
            })));
            __iced_deferrals._fulfill();
          })(function() {
            check = trackw.skip_remote_check();
            if (check === constants.skip.NONE) {
              log.console.log("...checking identity proofs");
              skp = false;
            } else {
              log.info("...all remote checks are up-to-date");
              skp = true;
            }
            (function(__iced_k) {
              __iced_deferrals = new iced.Deferrals(__iced_k, {
                parent: ___iced_passed_deferral,
                filename: "/home/max/src/keybase-node-client/src/track.iced",
                funcname: "TrackSubSubCommand._run2"
              });
              them.check_remote_proofs(skp, esc(__iced_deferrals.defer({
                assign_fn: (function() {
                  return function() {
                    return warnings = arguments[0];
                  };
                })(),
                lineno: 280
              })));
              __iced_deferrals._fulfill();
            })(function() {
              n_warnings = warnings.warnings().length;
              (function(__iced_k) {
                if ((approve = trackw.skip_approval()) !== constants.skip.NONE) {
                  log.debug("| skipping approval, since remote services & key are unchanged");
                  return __iced_k(accept = true);
                } else {
                  (function(__iced_k) {
                    if (_this.opts.batch) {
                      log.debug("| We needed approval, but we were in batch mode");
                      return __iced_k(accept = false);
                    } else {
                      (function(__iced_k) {
                        __iced_deferrals = new iced.Deferrals(__iced_k, {
                          parent: ___iced_passed_deferral,
                          filename: "/home/max/src/keybase-node-client/src/track.iced",
                          funcname: "TrackSubSubCommand._run2"
                        });
                        _this.prompt_ok(n_warnings, esc(__iced_deferrals.defer({
                          assign_fn: (function() {
                            return function() {
                              return accept = arguments[0];
                            };
                          })(),
                          lineno: 290
                        })));
                        __iced_deferrals._fulfill();
                      })(__iced_k);
                    }
                  })(__iced_k);
                }
              })(function() {
                err = null;
                (function(__iced_k) {
                  if (!accept) {
                    log.warn("Bailing out; proofs were not accepted");
                    return __iced_k(err = new E.CancelError("operation was canceled"));
                  } else {
                    (function(__iced_k) {
                      if ((check === constants.skip.REMOTE) && (approve === constants.skip.REMOTE)) {
                        return __iced_k(log.info("Nothing to do; tracking is up-to-date"));
                      } else {
                        (function(__iced_k) {
                          __iced_deferrals = new iced.Deferrals(__iced_k, {
                            parent: ___iced_passed_deferral,
                            filename: "/home/max/src/keybase-node-client/src/track.iced",
                            funcname: "TrackSubSubCommand._run2"
                          });
                          _this.prompt_track(esc(__iced_deferrals.defer({
                            assign_fn: (function() {
                              return function() {
                                return do_remote = arguments[0];
                              };
                            })(),
                            lineno: 299
                          })));
                          __iced_deferrals._fulfill();
                        })(function() {
                          (function(__iced_k) {
                            if (do_remote) {
                              (function(__iced_k) {
                                __iced_deferrals = new iced.Deferrals(__iced_k, {
                                  parent: ___iced_passed_deferral,
                                  filename: "/home/max/src/keybase-node-client/src/track.iced",
                                  funcname: "TrackSubSubCommand._run2"
                                });
                                session.load_and_login(esc(__iced_deferrals.defer({
                                  lineno: 300
                                })));
                                __iced_deferrals._fulfill();
                              })(__iced_k);
                            } else {
                              return __iced_k();
                            }
                          })(function() {
                            (function(__iced_k) {
                              __iced_deferrals = new iced.Deferrals(__iced_k, {
                                parent: ___iced_passed_deferral,
                                filename: "/home/max/src/keybase-node-client/src/track.iced",
                                funcname: "TrackSubSubCommand._run2"
                              });
                              trackw.store_track({
                                do_remote: do_remote
                              }, esc(__iced_deferrals.defer({
                                lineno: 301
                              })));
                              __iced_deferrals._fulfill();
                            })(__iced_k);
                          });
                        });
                      }
                    })(__iced_k);
                  }
                })(function() {
                  log.debug("- _run2");
                  return cb(err, accept);
                });
              });
            });
          });
        };
      })(this));
    };

    return TrackSubSubCommand;

  })();

}).call(this);