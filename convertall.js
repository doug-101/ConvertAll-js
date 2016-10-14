
//  convertall.js, the main JavaScript program file

//  ConvertAll, a versatile unit converter
//  Copyright (C) 2016, Douglas W. Bell

//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU Affero General Public License, either
//  version 3 of the License, or any later version.  This program is
//  distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY.
//  See <http://www.gnu.org/licenses/> for details.

"use strict";
var progName = "ConvertAll";
var version = "0.1.0";

function UnitDatum(datum) {
    // Class to store unit data from data file
    this.name = datum.name;
    this.equiv = datum.equiv;
    this.type = datum.type;
    this.unabbrev = datum.unabbrev ? datum.unabbrev : "";
    this.comment = datum.comment ? datum.comment : "";
    this.factor = 1.0;
    this.fromEqn = datum.fromeqn ? datum.fromeqn : ""; // for non-linear units
    this.toEqn = datum.toeqn ? datum.toeqn : ""; // for non-linear units
    if (!this.fromEqn) {  // linear units only
        var parts = this.equiv.split(" ", 2);
        if (parts.length > 1 && !/[^\d\.eE\+\-\*\/]/.test(parts[0])) {
            // check for numeric expression
            var num = eval(parts[0]);
            if (!(isNaN(num))) {
                this.factor = num;
                this.equiv = parts[1];
            }
        }
    }
}

// modify data from units.js file
data = data.map(function(datum) {
    return new UnitDatum(datum);
});
var unitData = {};
data.forEach(function(datum) {
    unitData[datum.name.toLowerCase()] = datum;
});
data = 0;  // recover memory

function UnitAtom(text) {
    // Class to store unit data as used in a unit group
    this.unitDatum = null;
    this.unitExp = 1;
    this.unitName = "";
    this.valid = true;
    this.partialExp = false;
    if (text) {
        var parts = text.split("^", 2);
        if (parts.length > 1) {
            var expText = parts[1].trim();
            var exp = Number(expText);
            if (expText && exp % 1 === 0) {  // check for integer
                this.unitExp = exp;
            } else {
                this.valid = false;
                this.partialExp = true;
                if (expText == "-") {
                    this.unitExp = -1;
                }
            }
        }
        var unit = unitData[parts[0].trim().toLowerCase()];
        if (unit) {
            this.unitDatum = unit;
            this.unitName = unit.name;
        } else {
            this.valid = false;
            this.unitName = text;
        }
    }
}
UnitAtom.prototype.firstExpPositive = function() {
    // check if unit has a positive exponent (negative flips operator)
    // same function as the unit group version
    return this.unitExp >= 0;
}
UnitAtom.prototype.unitString = function(useAbsExp) {
    // return a string for this unit and exponent
    // show exponent as positive if useAbsExp is true
    var text = this.unitName;
    var exp = useAbsExp ? Math.abs(this.unitExp) : this.unitExp;
    if (this.partialExp) {
        text += exp >= 0 ? "^" : "^-";
    } else if (exp !== 1) {
        text += "^" + exp;
    }
    return text;
}

function UnitGroup() {
    // Class to store a group of combined units
    this.unitList = [];
    this.valid = false;
    this.parenthClosed = true;
    this.linear = true;
    this.reducedList = [];
    this.factor = 1;
}
UnitGroup.prototype.parseGroup = function(text) {
    // create the unit group based on user text entry
    this.unitList = [];
    this.valid = true;
    this.parenthClosed = true;
    var parts;
    // use non-greedy regex if multiple indep parentheses, greedy for nested
    var parenthMatch = text.match(/\([^()]*?\)/g);
    if (parenthMatch && parenthMatch.length > 1) {
        parts = text.split(/(\(.*?\)|\(.*$|[\*\/])/);
    } else {
        parts = text.split(/(\(.*\)|\(.*$|[\*\/])/);
    }
    var prevOper = 1;  // 1 for *, -1 for /, 0 for none
    var unit;
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (!part) continue;
        if (part == "*" || part == "/") {
            if (prevOper !== 0) {  // add blank unit if operators adjacent
                unit = new UnitAtom("");
                unit.unitExp *= prevOper;
                this.unitList.push(unit);
                this.valid = false;
            }
            prevOper = part == "*" ? 1 : -1;
        } else if (part.slice(0, 1) == "(") {
            var closed = true;
            part = part.slice(1);
            if (part.slice(-1) == ")") {
                part = part.slice(0, -1);
            } else {
                this.valid = false;
                closed = false;
            }
            var group = new UnitGroup();
            group.parseGroup(part);
            group.parenthClosed = closed;
            if (prevOper === -1) {
                var flatList = group.flatUnitList();
                for (var j = 0; j < flatList.length; j++) {
                    flatList[j].unitExp *= -1;
                }
            }
            this.unitList.push(group);
            if (!group.valid) this.valid = false;
            prevOper = 0;
        } else {
            unit = new UnitAtom(part);
            unit.unitExp *= prevOper;
            this.unitList.push(unit);
            if (!unit.valid) this.valid = false;
            prevOper = 0;
        }
    }
    if (prevOper !== 0 || !this.unitList) {
        // add blank unit if operator at end or empty unit list
        unit = new UnitAtom("");
        unit.unitExp *= prevOper;
        this.unitList.push(unit);
        this.valid = false;
    }
}
UnitGroup.prototype.firstExpPositive = function() {
    // check if first unit has a positive exponent (negative flips operator)
    var unitList = this.unitList;
    while ("unitList" in unitList[0]) {
        unitList = unitList[0].unitList;
    }
    return unitList[0].unitExp >= 0;
}
UnitGroup.prototype.flatUnitList = function() {
    // return an array of units without nested groups
    var flatList = [];
    for (var i = 0; i < this.unitList.length; i++) {
        if (this.unitList[i].flatUnitList) {
            flatList = flatList.concat(this.unitList[i].flatUnitList());
        } else {
            flatList.push(this.unitList[i]);
        }
    }
    return flatList;
}
UnitGroup.prototype.groupString = function(swapExpSign) {
    // return a string representation of this unit group
    // switch exponent signs if swapExpSign is true
    var fullText = "";
    for (var i = 0; i < this.unitList.length; i++) {
        if (i > 0) {
            var isMultiply = this.unitList[i].firstExpPositive();
            if (swapExpSign) isMultiply = !isMultiply;
            fullText += isMultiply ? " * " : " / ";
        }
        if ("groupString" in this.unitList[i]) {
            var swap = swapExpSign;
            if (i > 0) {
                swap = !this.unitList[i].firstExpPositive();
            }
            fullText += "(" + this.unitList[i].groupString(swap);
            if (this.unitList[i].parenthClosed) {
                fullText += ")";
            }
        } else {
            var abs = i > 0 || swapExpSign;
            fullText += this.unitList[i].unitString(abs);
        }
    }
    return fullText;
}
UnitGroup.prototype.statusString = function() {
    // return the unit group string if unit valid, o/w no unit string
    var outputText = "No unit set";
    if (this.valid) {
        outputText = this.groupString();
    }
    return outputText;
}
UnitGroup.prototype.reduceGroup = function() {
    // create a reduced list of fundamental units and update the conv factor
    this.linear = true;
    this.reducedList = [];
    this.factor = 1;
    if (!this.valid) {
        return;
    }
    var rawReducedList = [];
    var expandedList = this.flatUnitList();
    var unit, equivGroup, equivList;
    while (expandedList.length > 0) {
        unit = expandedList.shift();
        if (unit.unitDatum.equiv.slice(0, 1) == "!") {
            rawReducedList.push(unit);
        } else {
            if (unit.unitDatum.fromEqn) this.linear = false;
            equivGroup = new UnitGroup();
            equivGroup.parseGroup(unit.unitDatum.equiv);
            equivList = equivGroup.flatUnitList();
            for (var i = 0; i < equivList.length; i++) {
                equivList[i].unitExp *= unit.unitExp;
            }
            expandedList = expandedList.concat(equivList);
            this.factor *= Math.pow(unit.unitDatum.factor, unit.unitExp);
        }
    }
    rawReducedList.sort(function(a, b) {
        var x = a.unitName.toLowerCase();
        var y = b.unitName.toLowerCase();
        if (x < y) return -1;
        if (x > y) return 1;
        return 0;
    });
    for (var j = 0; j < rawReducedList.length; j++) {
        if (this.reducedList.length && rawReducedList[j].unitName ==
                this.reducedList[this.reducedList.length - 1].unitName) {
            this.reducedList[this.reducedList.length - 1].unitExp +=
                rawReducedList[j].unitExp;
        } else {
            this.reducedList.push(rawReducedList[j]);
        }
    }
    this.reducedList = this.reducedList.filter(function(unit) {
        return unit.unitDatum.equiv != "!!" && unit.unitName != "unit" &&
                unit.unitExp !== 0;
    });
}
UnitGroup.prototype.categoryMatch = function(otherGroup) {
    // return true if units acceptable and reduced units match
    if (!this.checkLinearOk() || !otherGroup.checkLinearOk()) {
        return false;
    }
    return this.reducedString() === otherGroup.reducedString();
}
UnitGroup.prototype.checkLinearOk = function() {
    // return true if unit is linear or valid non-linear
    if (!this.linear) {
        var flatList = this.flatUnitList();
        if (flatList.length !== 1 || flatList[0].unitExp !== 1) {
            return false;
        }
    }
    return true;
}
UnitGroup.prototype.nonLinearCalc = function(num, isFrom) {
    // return a conversion factor for non-linear conversions
    // num is quantity and isFrom is true for a forward conversion
    var unit = this.flatUnitList()[0].unitDatum;
    var result;
    if (unit.toEqn) {  // regular equations
        var x = num;
        var pow = Math.pow;
        var log = Math.log;
        var exp = Math.exp;
        var sqrt = Math.sqrt;
        var pi = Math.PI;
        if (isFrom) {
            result = eval(unit.fromEqn);
        } else {
            result = eval(unit.toEqn);
        }
    } else {   // extrapolation list
        var data = eval(unit.fromEqn);
        if (!isFrom) {  // reverse the data groups
            data = data.map(function(group) {
                var tmp = group[0];
                group[0] = group[1];
                group[1] = tmp;
            });
        }
        data.sort(function(a, b) {
            return a[0] - b[0];
        });
        var pos = data.length - 1;
        for (var i = 0; i < data.length; i++) {
            if (num <= data[i][0]) {
                pos = i;
                break;
            }
        }
        if (pos == 0) pos = 1;
        result = (num - data[pos-1][0]) / (data[pos][0] - data[pos-1][0]) *
            (data[pos][1] - data[pos-1][1]) + data[pos-1][1];
    }
    return result;
}
UnitGroup.prototype.reducedString = function() {
    // return a group string for the reduced unit list
    var reduceGroup = new UnitGroup();
    reduceGroup.unitList = this.reducedList;
    return reduceGroup.groupString();
}
UnitGroup.prototype.compatStr = function() {
    // return the result of the reduced unit string or an error message if
    // non-linear units are illegal
    if (this.checkLinearOk()) {
        return this.reducedString();
    }
    return "Cannot combine non-linear units";
}

// set initial number editor values
var fromNumEditor = document.getElementById("fromnum");
fromNumEditor.value = 1;
var activeNumEditor = fromNumEditor;
var toNumEditor = document.getElementById("tonum");
toNumEditor.value = 1;

// create unit groups
var fromGroup = new UnitGroup();
var fromEditor = document.getElementById("fromeditor");
fromEditor.oninput = function() {
    // parse unit string after editor key press
    fromGroup.parseGroup(fromEditor.value);
    fromGroup.reduceGroup();
    document.getElementById("fromoutput").innerHTML = fromGroup.statusString();
    updateStatus();
}
fromEditor.oninput();  // set initial status strings

var toGroup = new UnitGroup();
var toEditor = document.getElementById("toeditor");
toEditor.oninput = function() {
    // parse unit string after editor key press
    toGroup.parseGroup(toEditor.value);
    toGroup.reduceGroup();
    document.getElementById("tooutput").innerHTML = toGroup.statusString();
    updateStatus();
}
toEditor.oninput();  // set initial status strings

function updateStatus() {
    // update the status output message and enable/disable the num editors
    var output = "";
    if (!fromGroup.valid || !toGroup.valid) {
        output = "Set units";
        fromNumEditor.disabled = true;
        toNumEditor.disabled = true;
    } else if (fromGroup.categoryMatch(toGroup)) {
        output = "Converting...";
        fromNumEditor.disabled = false;
        toNumEditor.disabled = false;
        activeNumEditor.oninput();
    } else {
        output = "Units are not compatible (" + fromGroup.compatStr()
            + " vs. " + toGroup.compatStr() + ")";
        fromNumEditor.disabled = true;
        toNumEditor.disabled = true;
    }
    document.getElementById("statusline").innerHTML = output;
}

fromNumEditor.oninput = function() {
    // do the conversion based on a number editor change
    var num = cleanNumInput(fromNumEditor);
    toNumEditor.value = convert(fromGroup, toGroup, num);
    activeNumEditor = fromNumEditor;
}

toNumEditor.oninput = function() {
    // do the conversion based on a number editor change
    var num = cleanNumInput(toNumEditor);
    fromNumEditor.value = convert(toGroup, fromGroup, num);
    activeNumEditor = toNumEditor;
}

function cleanNumInput(numEditor) {
    // evaluate a numeric expression from the number editor
    var value = numEditor.value;
    var cleanValue = value.replace(/[^\d\. eE\+\-\*\/\(\)]/g, "");
    if (value !== cleanValue) numEditor.value = cleanValue;
    try {
        return Number(eval(cleanValue));
    }
    catch (e) {
        return NaN;
    }
}

function convert(firstGroup, secondGroup, num) {
    // perform the conversion
    if (firstGroup.linear) {
        num *= firstGroup.factor;
    } else {
        num = firstGroup.nonLinearCalc(num, true) * firstGroup.factor;
    }
    if (secondGroup.linear) {
        num /= secondGroup.factor;
    } else {
        num = secondGroup.nonLinearCalc(num / secondGroup.factor, false);
    }
    return Number(num.toFixed(8));  // temporarily fixed at 8 dec plcs
}
