// Level definitions. Units are metres; the track runs left -> right, ground top ~ y=0.

import { B, lvl } from './builder.js';
import { genLevel, genRace } from './gen.js';
import SEEDS from './genseeds.json';
import { WORLD_DEFS } from './worlds.js';

// ---------------------------------------------------------------- CLASSIC
const classic = [
  lvl('Warm Up', 'grass', (b) => {
    b.ground(-8, 46, 0).hill(14, 22, 1.0).gems(16, 2.4, 3, 1.0).gem(30, 1.2).gem(33, 1.2).finish(40);
  }),
  lvl('Little Hop', 'grass', (b) => {
    b.ground(-8, 17, 0).ramp(11, 0, 17, 1.3, 'grass', -0.5).ground(23, 52, 0).gems(18, 2.8, 3, 1.6).gem(34, 1.2).finish(46);
  }),
  lvl('Plank Path', 'grass', (b) => {
    b.ground(-8, 10, 0).bridge(10, 0, 24, 0).ground(24, 36, 0).bridge(36, 0, 48, 0).ground(48, 66, 0)
      .gem(17, 0.7).gem(30, 1.2).gem(42, 0.7).finish(60);
  }, { ai: { zones: [[8, 50, 9]] } }),
  lvl('Step It Up', 'grass', (b) => {
    b.ground(-8, 10, 0).steps(10, 0, 5, 3, 0.45).ground(25, 34, 2.25).ramp(34, 2.25, 42, 0).ground(42, 60, 0)
      .gem(19, 2.6).gem(30, 3.4).gem(46, 1.2).finish(54);
  }, { water: -3 }),
  lvl('Hill Hopper', 'grass', (b) => {
    b.ground(-8, 86, 0).hill(10, 18, 1.2).hill(26, 34, 1.4).hill(42, 52, 1.6).hill(60, 68, 1.2)
      .gem(14, 2.6).gem(30, 2.8).gem(47, 3.2).finish(78);
  }, { ai: { zones: [[30, 47, 9]] } }),
  lvl('Seesaw Sea', 'grass', (b) => {
    b.ground(-8, 12.4, 0).block(17, -1.6, 0.6, 3.6, 'wood').seesaw(17, 0.3, 9.2, 0.2, 0.2)
      .ground(21.6, 44, -0.8).gem(14, 1.0).gem(17, 2.0).gem(30, 0.4).finish(38, -0.8);
  }, { ai: { zones: [[8, 24, 6]] } }),
  lvl('Rickety Bridge', 'grass', (b) => {
    b.ground(-8, 8, 0).bridge(8, 0, 30, 0.0).ground(30, 38, 0).ramp(33, 0, 38, 1.0, 'grass', -0.5)
      .ground(44, 64, 0).gem(14, 0.6).gem(24, 0.6).gem(41, 2.6).finish(58);
  }, { ai: { zones: [[6, 31, 8]] } }),
  lvl('Big Air', 'grass', (b) => {
    b.ground(-8, 22, 0).ramp(14, 0, 22, 2.0, 'grass', -0.5).ramp(32, 1.2, 44, 0, 'grass', -2).ground(44, 70, 0)
      .gems(24, 4.2, 3, 2.4).gem(55, 1.2).finish(64);
  }, { ai: { airAngle: -0.1 } }),
  lvl('Log Jam', 'grass', (b) => {
    b.ground(-8, 50, 0).dyn(14, 0.3, 0.6, 0.6, 'log', 0.2).dyn(15, 0.3, 0.6, 0.6, 'log', 0.2).dyn(14.5, 0.9, 0.6, 0.6, 'log', 0.2)
      .hill(20, 30, 1.2).stack(36, 0, 2, 2, 0.7, 'crate').bridge(50, 0, 62, 0).ground(62, 76, 0)
      .gem(25, 2.6).gem(44, 1.2).gem(56, 1.0).finish(70);
  }, { ai: { zones: [[48, 63, 6]] } }),
  lvl('Island Tour', 'grass', (b) => {
    b.ground(-8, 12, 0).bridge(12, 0, 22, 0).ground(22, 34, 0).ramp(28, 0, 34, 1.2, 'grass', -0.5)
      .ground(40, 52, 0).hill(43, 49, 1.0).block(56.6, -1.6, 0.6, 3.6, 'wood').seesaw(56.6, 0.3, 9, 0.2, 0.2)
      .ground(61.1, 80, -0.8).gem(17, 1.0).gem(37, 2.8).gem(46, 2.4).gem(66, 0.4).finish(74, -0.8);
  }, { ai: { zones: [[10, 23, 9], [52, 62, 6]] } }),
];

// ---------------------------------------------------------------- CONSTRUCTION
const construction = [
  lvl('Site Entry', 'concrete', (b) => {
    b.ground(-8, 50, 0).ramp(12, 0, 16, 0.8).ramp(16, 0.8, 20, 0).ground(26, 30, 0.6, 'girder', 0.6)
      .deco('cone', 6, 0).deco('cone', 8, 0).deco('barrier', 22, 0).gems(13, 2.0, 3, 2).gem(36, 1.2).finish(44);
  }),
  lvl('Girder Gap', 'concrete', (b) => {
    b.ground(-8, 12, 0).block(18, -0.2, 12, 0.4, 'girder').ground(24, 34, 0).ramp(29, 0, 34, 1.2, 'concrete', -0.5)
      .ground(40, 58, 0).gem(18, 1.0).gem(37, 2.8).gem(48, 1.2).finish(52);
  }),
  lvl('Crate Stack', 'concrete', (b) => {
    b.ground(-8, 56, 0).stack(14, 0, 3, 2, 0.75).stack(30, 0, 2, 2, 0.75).crate(42, 0, 1.0).crate(43, 0, 1.0)
      .gem(20, 1.2).gem(36, 1.2).gem(46, 1.2).finish(50);
  }),
  lvl('Scaffold Climb', 'concrete', (b) => {
    b.ground(-8, 8, 0).steps(8, 0, 6, 2.6, 0.42, 'girder').ground(23.6, 32, 2.52).ramp(32, 2.52, 40, 0).ground(40, 58, 0)
      .gem(13, 2.0).gem(20, 3.2).gem(28, 3.8).finish(52);
  }),
  lvl('Tilt Beam', 'concrete', (b) => {
    b.ground(-8, 12.4, 0).block(17, -1.6, 0.8, 3.6, 'girder').seesaw(17, 0.3, 9.2, 0.2, 0.2, 'girder')
      .ground(21.6, 34, -0.8).block(38.6, -2.4, 0.8, 3.6, 'girder').seesaw(38.6, -0.5, 9.2, 0.2, 0.2, 'girder')
      .ground(43.2, 60, -1.6).gem(17, 2.0).gem(28, 0.4).gem(38.6, 1.2).finish(54, -1.6);
  }, { ai: { zones: [[8, 46, 6]] }, water: -4 }),
  lvl('Shifting Slabs', 'concrete', (b) => {
    b.ground(-8, 10, 0).mover(14.5, -0.3, 6.5, 0.6, 1.6, 0, 2.6, 'girder').ground(19, 28, 0)
      .mover(33.5, -0.3, 6.5, 0.6, 1.6, 0, 2.2, 'girder', 1.5).ground(38, 56, 0)
      .gem(14.5, 1.0).gem(33.5, 1.0).gem(46, 1.2).finish(50);
  }),
  lvl('Ramp Rally', 'concrete', (b) => {
    b.ground(-8, 14, 0).ramp(8, 0, 14, 1.2).ground(20, 32, 0).ramp(26, 0, 32, 1.4).ground(39, 52, 0).ramp(46, 0, 52, 1.2).ground(58, 74, 0)
      .gem(17, 2.8).gem(35.5, 3.2).gem(55, 2.8).finish(68);
  }),
  lvl('Barrel Roll', 'concrete', (b) => {
    b.ground(-8, 10, 0).ramp(10, 0, 30, -3).ground(30, 56, -3)
      .dyn(18, 0, 0.7, 0.7, 'barrel', 0.15).dyn(22, -0.8, 0.7, 0.7, 'barrel', 0.15).dyn(26, -1.6, 0.7, 0.7, 'barrel', 0.15)
      .stack(38, -3, 3, 2, 0.8).gem(15, 0.4).gem(34, -1.8).gem(45, -1.8).finish(50, -3);
  }, { water: -6 }),
  lvl('Rooftops', 'concrete', (b) => {
    b.ground(-8, 14, 0).ramp(9, 0, 14, 1.0).ground(19, 27, 0.6, 'concrete', 3.6).ramp(23, 0.6, 27, 1.4)
      .ground(32, 40, 1.4, 'concrete', 4.4).ramp(36, 1.4, 40, 2.2).ground(45, 66, 0.8, 'concrete', 3.8)
      .gem(16.5, 2.6).gem(29.5, 3.4).gem(42.5, 4.2).finish(60, 0.8);
  }),
  lvl('Skyline', 'concrete', (b) => {
    b.ground(-8, 10, 0).block(16, -0.2, 12, 0.4, 'girder').ground(22, 31, 0).stack(25, 0, 3, 1, 0.65)
      .mover(34.5, -0.3, 6.5, 0.6, 1.4, 0, 2.4, 'girder').ground(38, 48, 0).ramp(42, 0, 48, 1.3)
      .ground(52, 62, 0).block(66.6, -1.6, 0.8, 3.6, 'girder').seesaw(66.6, 0.3, 9.2, 0.2, 0.2, 'girder')
      .ground(71.2, 88, -0.8).gem(16, 1.0).gem(34.5, 1.0).gem(51, 2.8).gem(76, 0.4).finish(82, -0.8);
  }, { ai: { zones: [[62, 72, 6]] } }),
];

// ---------------------------------------------------------------- MEDIEVAL
const medieval = [
  lvl('Castle Road', 'castle', (b) => {
    b.ground(-8, 56, 0, 'grass').hill(10, 18, 1.0, 0, 'castle').hill(26, 34, 1.4, 0, 'castle')
      .deco('torch', 6, 0).deco('banner', 22, 0).deco('torch', 38, 0).gem(14, 2.4).gem(30, 2.8).gem(42, 1.2).finish(50);
  }),
  lvl('Moat Jump', 'castle', (b) => {
    b.ground(-8, 16, 0, 'grass').ramp(10, 0, 16, 1.2, 'castle', -0.5).ground(22, 40, 0, 'castle')
      .ramp(34, 0, 40, 1.2, 'castle', -0.5).ground(46, 62, 0, 'grass').gem(19, 2.8).gem(43, 2.8).finish(56);
  }),
  lvl('Drawbridge', 'castle', (b) => {
    b.ground(-8, 11.6, 0, 'grass').hinge(12, -0.18, 11, 1.25, -0.02, 1.3, 'wood').block(23.4, -0.5, 0.8, 0.6, 'castle')
      .ground(23.8, 50, 0, 'castle').deco('banner', 27, 0).deco('banner', 33, 0).gem(17.5, 1.0).gem(36, 1.2).finish(44);
  }),
  lvl('Tower Steps', 'castle', (b) => {
    b.ground(-8, 8, 0, 'grass').steps(8, 0, 6, 2.5, 0.42).ground(23, 30, 2.52).ramp(30, 2.52, 34, 2.52)
      .bridge(30, 2.52, 42, 2.52).ground(42, 48, 2.52, 'castle', 5.5).ramp(48, 2.52, 56, 0, 'castle').ground(56, 70, 0, 'grass')
      .gem(16, 2.8).gem(36, 3.4).gem(52, 2.4).finish(64);
  }, { ai: { zones: [[28, 43, 9]] } }),
  lvl('Rope Bridges', 'castle', (b) => {
    b.ground(-8, 8, 0, 'grass').bridge(8, 0, 18, 0).ground(18, 24, 0).bridge(24, 0, 34, -0.8).ground(34, 40, -0.8)
      .bridge(40, -0.8, 52, 0).ground(52, 66, 0, 'grass').gem(13, 0.8).gem(29, 0.2).gem(46, 0.4).finish(60);
  }, { ai: { zones: [[6, 53, 8]] } }),
  lvl('Castle Gate', 'castle', (b) => {
    b.ground(-8, 60, 0, 'grass').block(24, 5.0, 10, 2, 'castle').ground(18.5, 30, 0.4, 'castle', 0.4)
      .hill(36, 44, 1.2, 0, 'castle').deco('torch', 17, 0).deco('torch', 31, 0)
      .gem(24, 1.6).gem(40, 2.6).gem(48, 1.2).finish(54);
  }),
  lvl('Battlements', 'castle', (b) => {
    b.ground(-8, 60, 0).block(12, 0.2, 2, 0.4).block(16, 0.2, 2, 0.4).block(20, 0.2, 2, 0.4).block(24, 0.2, 2, 0.4)
      .block(32, 0.25, 2.5, 0.5).block(37, 0.25, 2.5, 0.5).block(42, 0.25, 2.5, 0.5).deco('banner', 28, 0)
      .gem(14, 1.4).gem(22, 1.4).gem(39.5, 1.6).finish(54);
  }),
  lvl('Catapult', 'castle', (b) => {
    b.ground(-8, 12.4, 0, 'grass').block(17, -1.6, 0.8, 3.6, 'castle').seesaw(17, 0.3, 9.2, 0.2, 0.2)
      .ground(21.6, 30, -0.8, 'castle').ramp(25, -0.8, 30, 0.4, 'castle', -1.4).ground(36, 54, -0.4, 'grass')
      .gem(17, 2.0).gem(33, 2.4).gem(44, 0.8).finish(48, -0.4);
  }, { ai: { zones: [[8, 24, 6]] } }),
  lvl('Loose Planks', 'castle', (b) => {
    b.ground(-8, 10, 0, 'grass').block(14, -1.5, 0.8, 3, 'castle').block(18, -1.5, 0.8, 3, 'castle').block(22, -1.5, 0.8, 3, 'castle')
      .dyn(12, 0.15, 4.2, 0.3, 'wood', 1.2).dyn(16, 0.15, 4.2, 0.3, 'wood', 1.2).dyn(20, 0.15, 4.2, 0.3, 'wood', 1.2)
      .ground(22.4, 30, 0, 'castle').ramp(25, 0, 30, 1.2, 'castle', -0.5).ground(36, 54, 0, 'grass')
      .gem(16, 1.2).gem(33, 2.8).gem(42, 1.2).finish(48);
  }, { ai: { zones: [[8, 24, 7]] } }),
  lvl("King's Run", 'castle', (b) => {
    b.ground(-8, 11.6, 0, 'grass').hinge(12, -0.18, 10, 1.25, -0.02, 1.3, 'wood').block(22.4, -0.5, 0.8, 0.6)
      .ground(22.8, 34, 0).steps(34, 0, 3, 2.5, 0.42).ground(41.5, 46, 1.26).bridge(46, 1.26, 58, 1.26)
      .ground(58, 64, 1.26, 'castle', 4.3).ramp(64, 1.26, 70, 0).ground(70, 76, 0, 'grass').ramp(72, 0, 76, 1.0, 'castle', -0.5)
      .ground(82, 98, 0, 'grass').gem(17, 1.0).gem(38, 2.4).gem(52, 2.0).gem(79, 2.6).finish(92);
  }, { ai: { zones: [[44, 59, 9]] } }),
];

// ---------------------------------------------------------------- SCIENCE
const science = [
  lvl('Lab Entry', 'metal', (b) => {
    b.ground(-8, 56, 0).block(16, 0.3, 3, 0.6).pad(26, 0.02, 2.4, 11, 8).block(32, 0.6, 2, 1.2).deco('tank', 8, 0).deco('lamp', 22, 0)
      .gems(28, 3.2, 3, 1.4).gem(42, 1.2).finish(50);
  }),
  lvl('Bounce Pads', 'metal', (b) => {
    b.ground(-8, 14, 0).pad(12, 0.02, 2.4, 11, 8).ground(24, 32, 0).pad(30, 0.02, 2.4, 11, 8).ground(42, 58, 0)
      .gem(18, 3.6).gem(36, 3.6).gem(48, 1.2).finish(52);
  }),
  lvl('Low Gravity', 'metal', (b) => {
    b.ground(-8, 16, 0).ramp(10, 0, 16, 1.2).ground(23, 34, 0.8).ramp(28, 0.8, 34, 2.0).ground(46, 66, 0)
      .gems(19, 4.0, 3, 2.2).gems(37, 5.0, 3, 2.4).finish(60);
  }, { ai: { airAngle: -0.05 } }),
  lvl('Moving Lifts', 'metal', (b) => {
    b.ground(-8, 10, 0).mover(14.5, -0.3, 6.5, 0.6, 1.6, 0, 2.4).ground(19, 26, 0).mover(30.5, -0.3, 6.5, 0.6, 1.6, 0, 2.0, 'metal', 2)
      .ground(35, 40, 0).mover(44.5, -0.3, 6.5, 0.6, 1.6, 0, 2.8, 'metal', 1).ground(49, 64, 0)
      .gem(14.5, 1.0).gem(30.5, 1.0).gem(44.5, 1.0).finish(58);
  }),
  lvl('Test Tubes', 'metal', (b) => {
    b.ground(-8, 10, 0).ramp(5, 0, 10, 0.9).ground(15, 20, 0.6, 'metal', 3.6).ramp(17, 0.6, 20, 1.2)
      .ground(25, 30, 1.0, 'metal', 4).ramp(27, 1.0, 30, 1.6).ground(35, 52, 0.6, 'metal', 3.6)
      .deco('tank', 12.5, -2).deco('tank', 22.5, -2).deco('tank', 32.5, -2).gem(12.5, 2.4).gem(22.5, 3.0).gem(32.5, 3.4).finish(46, 0.6);
  }),
  lvl('Pad Hop', 'metal', (b) => {
    b.ground(-8, 12, 0).pad(10, 0.02, 2.4, 11, 8).ground(22, 30, 1.0).pad(28, 1.02, 2.4, 11, 8).ground(42, 60, 0.5)
      .gems(15, 4.4, 3, 2).gems(33, 5.4, 3, 2).finish(54, 0.5);
  }, { ai: { airAngle: -0.05 } }),
  lvl('Lift Off', 'metal', (b) => {
    b.ground(-8, 14, 0).pad(12, 0.02, 2.4, 6, 13).block(17, 0.5, 1.2, 7, 'metal').ground(17.6, 34, 4, 'metal', 7)
      .ramp(34, 4, 42, 0).ground(42, 58, 0).gem(14, 5.0).gem(26, 5.2).gem(46, 1.2).finish(52);
  }),
  lvl('Lab Crates', 'metal', (b) => {
    b.ground(-8, 60, 0).stack(12, 0, 3, 2, 0.85, 'labcrate').pad(22, 0.02, 2.4, 11, 7).stack(30, 0, 4, 2, 0.85, 'labcrate')
      .stack(44, 0, 2, 2, 0.85, 'labcrate').gem(25, 3.4).gem(38, 1.2).gem(50, 1.2).finish(54);
  }),
  lvl('Seesaw Leap', 'metal', (b) => {
    b.ground(-8, 12.4, 0).block(17, -1.6, 0.8, 3.6).seesaw(17, 0.3, 9.2, 0.2, 0.2, 'metal').ground(21.6, 30, -0.8)
      .ramp(25, -0.8, 30, 0.4, 'metal', -1.4).ground(36, 58, 0).gems(31, 3.0, 4, 2).finish(52);
  }, { ai: { zones: [[8, 24, 6]] } }),
  lvl('Reactor Run', 'metal', (b) => {
    b.ground(-8, 12, 0).pad(10, 0.02, 2.4, 11, 8).ground(22, 30, 0).mover(34.5, -0.3, 6.5, 0.6, 1.6, 0, 2.4).ground(39, 46, 0)
      .stack(42, 0, 2, 2, 0.85, 'labcrate').pad(50, 0.02, 2.4, 6, 13).ground(46, 54.4, 0).block(55, 0.5, 1.2, 7)
      .ground(55.6, 66, 4, 'metal', 7).ramp(66, 4, 74, 0).ground(74, 90, 0)
      .gem(16, 3.6).gem(34.5, 1.0).gem(52, 5.0).gem(80, 1.2).finish(84);
  }),
];

// ---------------------------------------------------------------- RACE TRACKS (5 lanes, wacky obstacles)
const race = (name, world, style, fn, opts = {}) => ({ ...lvl(name, style, fn, opts), raceWorld: world });
export const RACE_TRACKS = [
  race('Domino Dash', 0, 'grass', (b) => {
    b.ground(-8, 52, 0).dominoes(12, 8, 1.6).hill(28, 36, 1.2).wall(42, 2, 3).ground(58, 74, 0).pad(50, 0.02, 2.6, 12, 8)
      .dominoes(62, 6, 1.5).ground(80, 110, 0).ramp(74, 0, 80, 0, 'grass', -1).wall(88, 2, 2).finish(102)
      .gem(20, 1.2).gem(32, 2.8).gem(55, 4.2).gem(84, 1.2);
  }),
  race('Boulder Hill', 0, 'grass', (b) => {
    b.ground(-8, 18, 0).ramp(18, 0, 42, 3.6).ground(42, 56, 3.6, 'grass', 6.6).ramp(56, 3.6, 70, 0).ground(70, 80, 0)
      .ball(46, 4.6, 0.8, -3).ball(51, 4.6, 0.95, -2).ball(54, 4.6, 0.7, -4).pad(78, 0.02, 2.4, 12, 8).ground(88, 112, 0).ball(96, 1.0, 0.9).finish(104)
      .gem(30, 3.0).gem(49, 5.0).gem(84, 4.0);
  }, { ai: { zones: [[16, 44, 8]] } }),
  race('Hammer Time', 1, 'concrete', (b) => {
    b.ground(-8, 110, 0).hammer(18, 0, 1.2).hammer(28, 0, -1.1).hammer(38, 0, 1.0).wall(46, 2, 3, 0, 0.75)
      .hill(54, 62, 1.2, 0, 'girder').hammer(70, 0, -1.2).hammer(78, 0, 1.2).dominoes(86, 5, 1.5, 0, 2.2, 'girder').finish(102)
      .gem(23, 1.2).gem(33, 1.2).gem(58, 2.6).gem(74, 1.2);
  }),
  race('Bounce House', 3, 'metal', (b) => {
    b.ground(-8, 14, 0).pad(12, 0.02, 2.4, 11, 9).ground(26, 34, 1.0).pad(32, 1.02, 2.4, 11, 9).ground(46, 52, 0.5).pad(50, 0.52, 2.4, 11, 10)
      .ground(64, 76, 1.5).wall(70, 2, 2, 1.5, 0.75, 'labcrate').pad(74.6, 1.52, 2.4, 12, 8).ground(86, 108, 0).finish(100)
      .gems(17, 4.4, 3, 2.2).gems(37, 5.2, 3, 2.2).gems(55, 5.8, 3, 2.2);
  }),
  race('Seesaw Circus', 0, 'grass', (b) => {
    b.ground(-8, 12.4, 0).block(17, -1.6, 0.8, 3.6, 'wood').seesaw(17, 0.3, 9.2, 0.2, 0.2).ground(21.6, 28, -0.8)
      .block(32.6, -2.4, 0.8, 3.6, 'wood').seesaw(32.6, -0.5, 9.2, -0.2, 0.2).ground(37.2, 44, 0.3).ball(41, 1.2, 0.6)
      .block(48.6, -1.6, 0.8, 3.6, 'wood').seesaw(48.6, 0.3, 9.2, 0.2, 0.2).ground(53.2, 84, -0.8).dominoes(62, 6, 1.6, -0.8).finish(78, -0.8)
      .gem(17, 2.0).gem(32.6, 1.2).gem(48.6, 2.0).gem(70, 0.4);
  }, { ai: { zones: [[8, 56, 6]] } }),
  race('Crate Crash', 1, 'concrete', (b) => {
    b.ground(-8, 112, 0).wall(14, 1, 3).wall(24, 2, 2).ramp(30, 0, 36, 1.2).ground(36, 44, 1.2, 'girder', 4.2).ramp(44, 1.2, 50, 0)
      .wall(56, 1, 4, 0, 0.7).dominoes(66, 7, 1.4, 0, 2.2, 'girder').wall(82, 2, 2).ball(92, 0.9, 0.9).finish(104)
      .gem(20, 1.2).gem(40, 2.4).gem(62, 1.2).gem(88, 1.2);
  }),
  race('Castle Smash', 2, 'castle', (b) => {
    b.ground(-8, 11.6, 0, 'grass').hinge(12, -0.18, 10, 1.25, -0.02, 1.3, 'wood').block(22.4, -0.5, 0.8, 0.6)
      .ground(22.8, 40, 0).hammer(30, 0, 1.2).ramp(40, 0, 56, 3).ground(56, 66, 3, 'castle', 6).ball(60, 4.0, 0.9, -3).ball(64, 4.0, 0.8, -2)
      .ramp(66, 3, 78, 0).ground(78, 108, 0, 'grass').hammer(88, 0, -1.2).wall(94, 2, 3, 0, 0.75).finish(102)
      .gem(17, 1.0).gem(34, 1.2).gem(61, 5.0).gem(84, 1.2);
  }, { ai: { zones: [[38, 58, 8]] } }),
  race('Plank Panic', 2, 'castle', (b) => {
    b.ground(-8, 8, 0, 'grass').bridge(8, 0, 22, 0).ground(22, 30, 0).dominoes(24, 3, 1.5).bridge(30, 0, 44, -0.6).ground(44, 52, -0.6)
      .pad(50, -0.58, 2.4, 11, 8).ground(62, 70, 0).bridge(70, 0, 84, 0).ground(84, 106, 0, 'grass').wall(90, 2, 2).finish(100)
      .gem(15, 0.8).gem(37, 0.4).gem(56, 4.0).gem(77, 0.8);
  }, { ai: { zones: [[6, 45, 8], [68, 85, 8]] } }),
  race('Spin Cycle', 3, 'metal', (b) => {
    b.ground(-8, 108, 0).spin(20, 0.0, 4.2, 0.4, 0.9).hammer(36, 0, -1.2).mover(52, 3.0, 3, 0.5, 0, 1.2, 2.4, 'metal')
      .wall(62, 2, 3, 0, 0.75, 'labcrate').hammer(74, 0, 1.2).pad(84, 0.02, 2.4, 11, 7).finish(100)
      .gem(28, 1.2).gem(44, 1.2).gem(68, 1.2).gem(88, 3.6);
  }),
  race('Moon Bounce', 3, 'metal', (b) => {
    b.ground(-8, 14, 0).ramp(8, 0, 14, 1.0).ground(22, 34, 0.8).ball(30, 2.0, 0.9).pad(33, 0.82, 2.4, 9, 6).ground(48, 58, 0.5)
      .wall(52, 2, 3, 0.5, 0.75, 'labcrate').ramp(54, 0.5, 58, 1.4).ground(70, 100, 0).dominoes(76, 5, 1.6).finish(94)
      .gems(17, 4.0, 3, 2.2).gems(38, 5.0, 3, 2.6).gems(61, 4.6, 3, 2.4);
  }, { ai: { airAngle: -0.05 } }),
  race('Rolling Thunder', 2, 'castle', (b) => {
    b.ground(-8, 10, 0, 'grass').ramp(10, 0, 40, 4.5).ground(40, 52, 4.5, 'castle', 7.5)
      .ball(45, 5.5, 0.9, 0).ball(49, 5.5, 0.8, 0)
      .hammer(46, 4.5, 1.1).ramp(52, 4.5, 72, 0).ground(72, 106, 0, 'grass').ball(84, 1.0, 0.9).wall(90, 2, 3).finish(100)
      .gem(25, 3.4).gem(46, 5.6).gem(62, 3.4).gem(80, 1.2);
  }, { ai: { zones: [[8, 42, 8]] } }),
  race('Grand Chaos', 1, 'concrete', (b) => {
    b.ground(-8, 40, 0).dominoes(10, 5, 1.5).hammer(24, 0, 1.2).wall(32, 2, 3).pad(38, 0.02, 2.4, 12, 8).ground(50, 58, 0.5, 'girder', 3.5)
      .block(62.6, -1.6, 0.8, 3.6, 'girder').seesaw(62.6, 0.3, 9.2, 0.2, 0.2, 'girder').ground(67.2, 112, -0.8).hammer(78, -0.8, 1.1)
      .ball(90, 0.2, 0.9, -2).hammer(96, -0.8, -1.2).finish(106, -0.8)
      .gem(17, 1.2).gem(44, 4.2).gem(62.6, 2.0).gem(86, 0.4);
  }, { ai: { zones: [[56, 70, 6]] } }),
];
// 20 extra seeded random tracks (validated by tools/gensel.mjs)
// sea jump finale (open water every truck clears on its own speed): levels 10 and 20 from world 5, every 4th seeded track
export const SEA_GAP = 14;
export const levelSea = (fresh, k) => (fresh && (k === 9 || k === 19) ? SEA_GAP : 0);
export const raceSea = (i) => (i % 4 === 1 ? SEA_GAP : 0);
(SEEDS.races || []).forEach(({ w, seed }, i) => RACE_TRACKS.push(genRace(w, seed, { sea: raceSea(i) })));
RACE_TRACKS.forEach((l, i) => { l.world = l.raceWorld; l.index = i; l.id = `race-${i + 1}`; l.race = true; });

const HANDMADE = { classic, construction, medieval, science };
export const WORLDS = WORLD_DEFS.map((d) => ({ ...d, levels: [...(HANDMADE[d.id] || [])] }));

// levels 11-20 of each world: seeded generator, difficulty ramps up (validated by tools/gensel.mjs)
// worlds 1-4: levels 11-20; worlds 5-20: all 20 levels, starting easier
export const genDiff = (k, fresh = false) => (fresh ? 0.15 + (0.85 * k) / 19 : 0.4 + (0.6 * k) / 9);
for (const w of WORLDS) {
  const fresh = !HANDMADE[w.id];
  (SEEDS.levels?.[w.id] || []).forEach((seed, k) => w.levels.push(genLevel(w.id, seed, genDiff(k, fresh), { sea: levelSea(fresh, k) })));
}
WORLDS.forEach((w, wi) => w.levels.forEach((l, li) => { l.world = wi; l.index = li; l.id = `${w.id}-${li + 1}`; }));
export const allLevels = () => WORLDS.flatMap((w) => w.levels);
