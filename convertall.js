
//  convertall.js, the main JavaScript program file

//  ConvertAll, a versatile unit converter
//  Copyright (C) 2020, Douglas W. Bell

//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU Affero General Public License, either
//  version 3 of the License, or any later version.  This program is
//  distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY.
//  See <http://www.gnu.org/licenses/> for details.

"use strict";
var progName = "ConvertAll";
var author = "Doug Bell"
var version = "0.1.4+";

var selectedBackground = "#cd2c00";
var highlightBackground = "#ffff90";

function Settings() {
    // Class to store, retrieve and set user options
    this.recentUnits = [];
    this.resultDisplay = "short"; // or fixed, scientific, engineering
    this.numDecPlaces = 8;
    this.numRecentUnits = 8;
    this.loadRecentAtStart = false;
    this.showStartTip = true;
    this.dialogContainer = document.getElementById("opt-dialog");
}
Settings.prototype.addRecentUnit = function(unitText) {
    // add a new recent unit to the list
    var pos = this.recentUnits.indexOf(unitText);
    if (pos >= 0) this.recentUnits.splice(pos, 1);
    this.recentUnits.unshift(unitText);
    if (this.recentUnits.length > this.numRecentUnits) this.recentUnits.pop();
    this.saveRecentUnits();
}
Settings.prototype.recentEntries = function() {
    // return text with recent unit menu entries
    var text = "";
    for (var i = 0; i < this.recentUnits.length; i++) {
        text += '<div onclick="addRecentUnit(this)">' + this.recentUnits[i] +
            '</div>\n';
    }
    return text;
}
Settings.prototype.loadRecentUnits = function() {
    // load recent units into editors if option is enabled
    if (this.loadRecentAtStart) {
        if (this.recentUnits.length > 0) {
            fromController.setNewText(this.recentUnits[0]);
            if (this.recentUnits.length > 1) {
                toController.setNewText(this.recentUnits[1]);
            }
        }
    }
}
Settings.prototype.showOptions = function() {
    // show and initialize the options dialog
    document.getElementById("close-opt-button").onclick = function() {
        settings.hideOptions();
    }
    document.getElementById("reset-button").onclick = function() {
        settings.showOptions();
    }
    document.getElementById("submit-button").onclick = function() {
        settings.updateOptions();
    }
    document.getElementById(this.resultDisplay).checked = true;
    document.getElementById("dec-places").value = this.numDecPlaces;
    document.getElementById("num-recent").value = this.numRecentUnits;
    document.getElementById("load-recent").checked = this.loadRecentAtStart;
    document.getElementById("show-tip").checked = this.showStartTip;
    this.dialogContainer.style.display = "block";
}
Settings.prototype.updateOptions = function() {
    // retrieve changes from options dialog and close it
    this.resultDisplay = document.
        querySelector('input[name="display"]:checked').value;
    this.numDecPlaces = document.getElementById("dec-places").value;
    if (this.numDecPlaces < 0) this.numDecPlaces = 0;
    if (this.numDecPlaces > 9) this.numDecPlaces = 9;
    this.numRecentUnits = document.getElementById("num-recent").value;
    if (this.numRecentUnits < 0) this.numRecentUnits = 0;
    if (this.numRecentUnits > 99) this.numRecentUnits = 99;
    this.loadRecentAtStart = document.getElementById("load-recent").checked;
    this.showStartTip = document.getElementById("show-tip").checked;
    activeNumControl.updateFormat();
    while (this.recentUnits.length > this.numRecentUnits) {
        this.recentUnits.pop();
    }
    this.saveOptions();
    this.hideOptions();
}
Settings.prototype.hideOptions = function() {
    // hide the options dialog
    this.dialogContainer.style.display = "none";
    updateFocus();
}
Settings.prototype.saveOptions = function() {
    // save option settings to local storage
    if (typeof(localStorage) !== "undefined") {
        localStorage.resultDisplay = this.resultDisplay;
        localStorage.numDecPlaces = this.numDecPlaces;
        localStorage.numRecentUnits = this.numRecentUnits;
        localStorage.loadRecentAtStart = this.loadRecentAtStart;
        localStorage.showStartTip = this.showStartTip;
    }
}
Settings.prototype.saveRecentUnits = function() {
    // save recent units to local storage
    if (typeof(localStorage) !== "undefined") {
        localStorage.recentUnits = this.recentUnits.toString();
    }
}
Settings.prototype.restoreSettings = function() {
    // restore option settings from local storage
    if (typeof(localStorage) !== "undefined") {
        var display = localStorage.resultDisplay;
        if (["short", "fixed", "scientific", "engineering"].
                indexOf(display) >= 0) {
            this.resultDisplay = display;
        }
        var decPlcs = parseInt(localStorage.numDecPlaces);
        if (decPlcs >= 0 && decPlcs < 10) {
            this.numDecPlaces = decPlcs;
        }
        var numRecents = localStorage.numRecentUnits;
        if (numRecents >= 0 && numRecents < 100) {
            this.numRecentUnits = numRecents;
        }
        if (localStorage.loadRecentAtStart == "true") {
            this.loadRecentAtStart = true;
        }
        if (localStorage.showStartTip == "false") {
            this.showStartTip = false;
        }
    }
}
Settings.prototype.restoreRecentUnits = function() {
    // restore recent units from local storage
    if (typeof(localStorage) !== "undefined") {
        var recents = localStorage.recentUnits;
        if (recents != null) {
            recents = recents.split(",");
            var unit;
            for (var i = 0; i < recents.length && i < this.numRecentUnits;
                    i++) {
                unit = new UnitGroup();
                unit.parseGroup(recents[i]);
                if (unit.valid) this.recentUnits.push(recents[i]);
            }
        }
    }
}
var settings = new Settings();
settings.restoreSettings();

function UnitDatum(datum) {
    // Class to store data for a unit from data file
    this.name = datum.name;
    this.equiv = datum.equiv;
    this.type = datum.type;
    this.unabbrev = datum.unabbrev ? datum.unabbrev : "";
    this.comment = datum.comment ? datum.comment : "";
    this.factor = 1.0;
    this.fromEqn = datum.fromeqn ? datum.fromeqn : ""; // for non-linear units
    this.toEqn = datum.toeqn ? datum.toeqn : ""; // for non-linear units
    this.key1 = "";  // temporary use for sorting
    this.key2 = 0;   // temporary use for sorting
    if (!this.fromEqn) {  // linear units only
        var parts = this.equiv.split(" ");
        if (parts.length > 1 && !/[^\d\.eE\+\-\*\/]/.test(parts[0])) {
            // check for numeric expression
            var num = eval(parts.shift());
            if (!(isNaN(num))) {
                this.factor = num;
                this.equiv = parts.join(" ");
            }
        }
    }
}
UnitDatum.prototype.tableEntry = function() {
    // return a table row string for this unit
    var name = this.name;
    if (this.unabbrev) name += " (" + this.unabbrev + ")";
    return '<tr onclick="unitData.changeSelection(this)" onmouseover=' +
        '"unitData.highlightElem(this)"><td>' + name + '</td><td>' +
        this.type + '</td><td>' + this.comment + '</td></tr>';
}

function UnitData() {
    // Class to store lists and dicts of data for units
    this.unitDict = {};
    this.unitArray = [];
    this.unitTypeList = [];
    this.unitSearchList = [];
    this.filteredUnits = [];
    this.sortKeyNum = 0;  // sorting column number
    this.sortDirection = 1;  // negative for reverse
    this.typeFilter = "";
    this.selectedIndex = -1;
    this.highlightIndex = -1;
    this.blockMouseHighlight = false; // block highlight on keyboard movement
    this.unitTable = document.getElementById("unit-list-body");
    var unit, splitName;
    // modify data from units.js file:
    for (var i = 0; i < data.length; i++) {
        unit = new UnitDatum(data[i]);
        this.unitDict[unit.name.replace(/ /g, "").toLowerCase()] = unit;
        this.unitArray.push(unit);
        if (this.unitTypeList.indexOf(unit.type) < 0) {
            this.unitTypeList.push(unit.type);
        }
        splitName = unit.name.split(" ");
        for (var j = 0; j < splitName.length; j++) {
            this.unitSearchList.push([splitName[j].toLowerCase(), unit]);
        }
    }
    data = 0;  // recover memory
    this.updateSortHeaders();
    this.sortUnitList(this.unitArray);
    this.filteredUnits = this.unitArray;
    this.updateUnitTable();
    this.numVisibleRows = Math.floor(this.unitTable.offsetHeight /
        this.unitTable.rows[0].offsetHeight);
    this.highlightRow(0);
    this.unitTypeList.sort();
}
UnitData.prototype.sortUnits = function(keyNum) {
    // sort unit array based on given sort key number
    if (keyNum == this.sortKeyNum) {
        this.sortDirection *= -1;
    } else {
        this.sortDirection = 1;
    }
    this.sortKeyNum = keyNum;
    this.updateSortHeaders();
    this.sortUnitList(this.unitArray);
    if (this.filteredUnits.length == this.unitArray.length)  {
        this.filteredUnits = this.unitArray;
    } else {
        this.sortUnitList(this.filteredUnits);
    }
    if (!activeController) this.updateUnitTable();
    updateFocus();
}
UnitData.prototype.updateSortHeaders = function() {
    // update table headers based on stored sort parameters
    var headings = ["Unit Names", "Unit Type", "Comments"];
    var headingText = "";
    for (var i = 0; i < 3; i++) {
        headingText += '<th onclick="unitData.sortUnits(this.cellIndex)">' +
            headings[i];
        if (i == this.sortKeyNum) {
            if (this.sortDirection > 0) {
                headingText += '&nbsp;&#9650;';
            } else {
                headingText += '&nbsp;&#9660;';
            }
        } else {
             headingText += '&nbsp;&nbsp;&nbsp;';
        }
        headingText += '</th>';
    }
    document.getElementById("header-row").innerHTML = headingText;
}
UnitData.prototype.sortUnitList = function(unitList) {
    // sort given unit list based on stored sort parameters
    var sortKeyList = ["name", "type", "comment"];
    var sortKey = sortKeyList[this.sortKeyNum];
    var sortDir = this.sortDirection;
    for (var i = 0; i < unitList.length; i++) {
        unitList[i].key1 = unitList[i][sortKey].toLowerCase();
        unitList[i].key2 = i;  // use prev sequence for stable sort
    }
    unitList.sort(function(a, b) {
        if (a.key1 < b.key1) return -1 * sortDir;
        if (a.key1 > b.key1) return sortDir;
        if (a.key2 < b.key2) return -1;
        if (a.key2 > b.key2) return 1;
        return 0;
    });
}
UnitData.prototype.typeEntries = function() {
    // return text with unit type entries for filter menu
    var text = "";
    for (var i = 0; i < this.unitTypeList.length; i++) {
        text += '<div onclick="unitData.addTypeFilter(this)">' +
            this.unitTypeList[i] + '</div>\n';
    }
    return text;
}
UnitData.prototype.addTypeFilter = function(elem) {
    // set type filter based on menu selection
    this.typeFilter = elem.innerHTML;
    var searchString = "";
    if (activeController) {
        searchString = activeController.unitGroup.currentUnitName();
    }
    this.filterUnits(searchString);
    document.getElementById("filter-button").innerHTML = "Clear Filter";
    updateFocus();
}
UnitData.prototype.filterUnits = function(searchString) {
    // update filteredUnits to only contain matches
    var selectNum = -1;
    if (!searchString) {
        if (this.typeFilter) {
            this.filteredUnits = [];
            for (var i = 0; i < this.unitArray.length; i++) {
                if (this.unitArray[i].type == this.typeFilter) {
                    this.filteredUnits.push(this.unitArray[i]);
                }
            }
        } else {
            this.filteredUnits = this.unitArray;
        }
    } else {
        var strings = searchString.toLowerCase().split(" ");
        var matchedNames = [];
        for (var i = 0; i < this.unitSearchList.length; i++) {
            for (var j = 0; j < strings.length; j++) {
                if (this.unitSearchList[i][0].slice(0, strings[j].length) ==
                        strings[j]) {
                    matchedNames.push(this.unitSearchList[i][1].name);
                }
            }
        }
        this.filteredUnits = [];
        for (var i = 0; i < this.unitArray.length; i++) {
            if (matchedNames.indexOf(this.unitArray[i].name) >= 0) {
                if (!this.typeFilter ||
                        this.unitArray[i].type == this.typeFilter) {
                    this.filteredUnits.push(this.unitArray[i]);
                    if (this.unitArray[i].name == searchString) {
                        selectNum = this.filteredUnits.length - 1;
                    }
                }
            }
        }
    }
    this.updateUnitTable();
    if (selectNum >= 0) {
        this.selectUnit(selectNum);
        this.highlightIndex = this.selectedIndex;
    } else {
        this.highlightRow(0);
    }
}
UnitData.prototype.updateUnitTable = function() {
    // update unit table with filtered unit list
    var tableList = [];
    for (var i = 0; i < this.filteredUnits.length; i++) {
        tableList.push(this.filteredUnits[i].tableEntry())
    }
    this.unitTable.innerHTML = tableList.join("\n");
    this.unitTable.scrollTop = 0;
    this.selectedIndex = -1;
    this.highlightIndex = -1;
    this.blockMouseHighlight = false;
}
UnitData.prototype.selectUnit = function(i) {
    // select a unit in the table by index number (-1 for none)
    var rows = this.unitTable.rows;
    if (this.selectedIndex >= 0) {
        rows[this.selectedIndex].style.backgroundColor = "inherit";
        rows[this.selectedIndex].style.color = "inherit";
    }
    if (i >= 0 && activeController) {
        rows[i].style.backgroundColor = selectedBackground;
        rows[i].style.color = "white";
        this.makeRowVisible(i);
        this.selectedIndex = i;
    } else {
        this.selectedIndex = -1;
    }
}
UnitData.prototype.changeSelection = function(elem) {
    // update the selection and replace a unit based on a mouse click
    var i = elem.rowIndex - 1;
    this.selectUnit(i);
    if (activeController) {
        activeController.editor.focus();
        this.replaceInGroup(i);
    } else {
        updateFocus();
    }
}
UnitData.prototype.replaceInGroup = function(i) {
    // replace a unit by index number
    var unit = new UnitAtom(this.filteredUnits[i].name);
    var group = activeController.unitGroup;
    group.replaceUnit(unit);
    group.checkUnitValid();
    activeController.updateStatus();
}
UnitData.prototype.selectHighlight = function() {
    if (activeController && this.highlightIndex >= 0) {
        this.selectUnit(this.highlightIndex);
        this.replaceInGroup(this.highlightIndex);
    }
}
UnitData.prototype.highlightElem = function(elem) {
    // set table row to be highlighted based on a mouse-over
    if (this.blockMouseHighlight) {
        this.blockMouseHighlight = false; // block once after keyboard move
    } else {
        var rows = this.unitTable.rows;
        var rowNum = elem.rowIndex - 1;
        var topRowNum = Math.round(this.unitTable.scrollTop /
            rows[0].offsetHeight);
        if (rowNum >= topRowNum && rowNum < topRowNum + this.numVisibleRows) {
            this.highlightRow(rowNum);
        }
    }
}
UnitData.prototype.highlightRow = function(rowNum) {
    // set table row to be highlighted based on row number
    var rows = this.unitTable.rows;
    if (rowNum < rows.length) {
        if (this.highlightIndex >= 0 && this.highlightIndex < rows.length &&
                this.highlightIndex != this.selectedIndex) {
            rows[this.highlightIndex].style.backgroundColor = "inherit";
        }
        if (activeController && rowNum >= 0) {
            if (rowNum != this.selectedIndex) {
                rows[rowNum].style.backgroundColor = highlightBackground;
                this.makeRowVisible(rowNum);
            }
            this.highlightIndex = rowNum;
        }
    }
}
UnitData.prototype.moveHighlight = function(delta) {
    // move hightlight based on delta amount
    var row = this.highlightIndex + delta;
    if (row < 0) row = 0;
    var maxRow = this.unitTable.rows.length - 1;
    if (row > maxRow) row = maxRow;
      this.highlightRow(row);
}
UnitData.prototype.makeRowVisible = function(rowNum) {
    // scroll if necessary to make given row number visible
    var rows = this.unitTable.rows;
    var topRowNum = Math.round(this.unitTable.scrollTop /
        rows[0].offsetHeight);
    if (rowNum < topRowNum) {
        this.unitTable.scrollTop = rows[rowNum].offsetTop - rows[0].offsetTop;
        this.blockMouseHighlight = true;
    } else if (rowNum >= topRowNum + this.numVisibleRows) {
        this.unitTable.scrollTop = rows[rowNum - this.numVisibleRows + 1].
            offsetTop - rows[0].offsetTop;
        this.blockMouseHighlight = true;
    }
}
var unitData = new UnitData();

function UnitAtom(text) {
    // Class to store unit data as used in a unit group
    this.unitDatum = null;
    this.unitExp = 1;
    this.unitName = "";
    this.valid = true;
    this.partialExp = "";  // starts with '^' for incomplete exp
    if (text) {
        var parts = text.split("^", 2);
        var key = parts[0].replace(/ /g, "").toLowerCase();
        if (parts.length > 1 && parts[0]) {
            var expText = parts[1].trim();
            var exp = Number(expText);
            if (expText && !isNaN(exp)) {  // check for valid number
                this.unitExp = exp;
                if (exp.toString() != expText) {
                    this.partialExp = "^" + expText;
                } else if (exp == 1) {
                    this.partialExp = "^1";  // keep for start of "1.5"
                }
            } else {
                this.valid = false;
                if (expText == ".") {
                    this.partialExp = "^0.";
                } else if (expText == "-.") {
                    this.partialExp = "^-0.";
                } else if (expText.slice(0, 1) == "-") {
                    this.partialExp = "^-";
                } else {
                    this.partialExp = "^";
                }
            }
        } else if ((key.slice(-1) == "2" || key.slice(-1) == "3") &&
                   unitData.unitDict[key.slice(0, -1)]) {
            //  allow skipping the "^" for simple exponents on known units
            this.unitExp = Number(key.slice(-1));
            key = key.slice(0, -1);
        }
        var unit = unitData.unitDict[key];
        if (unit) {
            this.unitDatum = unit;
            this.unitName = unit.name;
        } else {
            this.valid = false;
            this.unitName = parts[0];
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
        text += this.partialExp;
    } else if (exp !== 1) {
        text += "^" + exp;
    }
    return text;
}

function UnitGroup() {
    // Class to store a group of combined units
    this.unitList = [new UnitAtom("")];
    this.valid = false;
    this.parenthClosed = true;
    this.linear = true;
    this.reducedList = [];
    this.factor = 1;
    this.currentUnitNum = 0;
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
UnitGroup.prototype.currentUnitName = function() {
    // return the text name of the current unit within the group
    var unit = this.flatUnitList()[this.currentUnitNum];
    return unit.unitName;
}
UnitGroup.prototype.currentUnitLocation = function() {
    // return an array with the current unit's group and its index
    var delta = 0;
    for (var i = 0; i < this.unitList.length; i++) {
        if (this.unitList[i].currentUnitLocation) {
            var groupLength = this.unitList[i].flatUnitList().length;
            if (i + delta + groupLength > this.currentUnitNum) {
                this.unitList[i].currentUnitNum = this.currentUnitNum -
                    (i + delta);
                return this.unitList[i].currentUnitLocation();
            } else {
                delta += groupLength - 1;
            }
        } else if (i + delta == this.currentUnitNum) {
            return [this, i];
        }
    }
}
UnitGroup.prototype.replaceUnit = function(newUnit) {
    // replace the unit at posNum with the newUnit
    var currLoc = this.currentUnitLocation();
    var group = currLoc[0];
    var i = currLoc[1];
    newUnit.unitExp = group.unitList[i].unitExp;
    group.unitList[i] = newUnit;
}
UnitGroup.prototype.setCurrentExp = function(num) {
    // Set the exponent of the current unit to num
    var flatList = this.flatUnitList();
    if (flatList.length > this.currentUnitNum) {
        var unit = flatList[this.currentUnitNum];
        unit.unitExp = unit.unitExp >= 0 ? num : -num;
        this.reduceGroup();
    }
}
UnitGroup.prototype.addOperator = function(oper) {
    // add a blank unit after the current unit, which adds a new operator
    var currLoc = this.currentUnitLocation();
    var group = currLoc[0];
    var i = currLoc[1];
    var unit = new UnitAtom("");
    if (oper == "/") unit.unitExp = -1;
    if (group != this && group.unitList[0].unitExp < 0) unit.unitExp *= -1;
    group.unitList.splice(i + 1, 0, unit);
    this.valid = false;
}
UnitGroup.prototype.checkUnitValid = function() {
    // set validity based on unit contents
    this.valid = this.flatUnitList().every(function(a) {
        return a.valid;
    }) && this.parenthClosed;
    this.reduceGroup();
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
        outputText = outputText.replace(/\^([0-9.-]+)/g,"<sup>$1</sup>");
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
    var unit, exp, equivGroup, equivList;
    while (expandedList.length > 0) {
        unit = expandedList.shift();
        if (unit.unitDatum.equiv.slice(0, 1) == "!") {
            exp = unit.unitExp;
            unit = new UnitAtom(unit.unitName);
            unit.unitExp = exp;
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
        var tmp;
        if (!isFrom) {  // reverse the data groups
            data = data.map(function(group) {
                tmp = group[0];
                group[0] = group[1];
                group[1] = tmp;
                return group;
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

function UnitController(editorId, statusId) {
    // class to store and control unit groups and editors
    this.editor = document.getElementById(editorId);
    this.statusOutput = document.getElementById(statusId);
    this.unitGroup = new UnitGroup();
    var that = this;
    this.editor.oninput = function() {
        that.updateUnit();
    }
    this.editor.onkeydown = function(e) {
        // handle keyboard navigation for highlighted unit table rows
        switch (e.which) {
            case 38:  // up arrow
                unitData.moveHighlight(-1);
                e.preventDefault();
                break;
            case 40:  // down arrow
                unitData.moveHighlight(1);
                e.preventDefault();
                break;
            case 33:  // page up
                unitData.moveHighlight(0 - unitData.numVisibleRows);
                e.preventDefault();
                break;
            case 34:  // page down
                unitData.moveHighlight(unitData.numVisibleRows);
                e.preventDefault();
                break;
            case 13:  // enter
                unitData.selectHighlight();
                e.preventDefault();
                break;
        }
    }
    this.editor.onkeyup = function(e) {
        // check for end, home, left, right keys
        if ([35, 36, 37, 39].indexOf(e.which) >= 0) {
            that.updateCurrentUnit(false);
        }
    }
    this.editor.onclick = function() {
        that.updateCurrentUnit(false);
    }
    this.editor.onfocus = function() {
        activeController = that;
        activeController.updateCurrentUnit(true);
    }
    this.statusOutput.innerHTML = this.unitGroup.statusString();
}
UnitController.prototype.updateUnit = function() {
    // parse unit string after editor key press
    if (this.editor.value.replace(/ /g, "") !=
            this.unitGroup.groupString().replace(/ /g, "")) {
            // skip update if only spacing change
        this.unitGroup.parseGroup(this.editor.value);
        this.unitGroup.reduceGroup();
        this.updateStatus();
    }
}
UnitController.prototype.setNewText = function(unitText) {
    // set editor text to unitText and update
    this.unitGroup.parseGroup(unitText);
    this.unitGroup.reduceGroup();
    this.updateStatus();
}
UnitController.prototype.updateStatus = function() {
    // replace editor text and update statuses after unit changes
    this.replaceAllText();
    updateConversion();
    this.updateCurrentUnit(true);
    this.statusOutput.innerHTML = this.unitGroup.statusString();
}
UnitController.prototype.updateCurrentUnit = function(fullUpdate) {
    // update the current unit based on key or mouse cursor changes
    // if fullUpdate is true, force an update of the unit list view filter
    var prevCurrentUnit = this.unitGroup.currentUnitNum;
    var unitStr = this.editor.value;
    var partStr = unitStr.slice(0, this.editor.selectionStart);
    var matches = partStr.match(/[\*\/]/g);
    this.unitGroup.currentUnitNum = matches ? matches.length : 0;
    if (fullUpdate || this.unitGroup.currentUnitNum != prevCurrentUnit) {
        unitData.filterUnits(this.unitGroup.currentUnitName());
    }
    this.setButtonsEnabled(true, unitStr.trim().length > 0,
                           this.unitGroup.currentUnitName().length > 0);
}
UnitController.prototype.replaceAllText = function() {
    // replace the editor text with the unit group string
    var revCursorPos = this.editor.value.length - this.editor.selectionStart;
    this.editor.value = this.unitGroup.groupString();
    var cursorPos = this.editor.value.length - revCursorPos;
    this.editor.setSelectionRange(cursorPos, cursorPos);
}
UnitController.prototype.setButtonsEnabled = function(hasFocus, hasContent,
                                                      hasCurrentUnit) {
    // enable or disable unit-specific buttons
    var buttons = document.getElementsByClassName("unit-button");
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].disabled = !hasCurrentUnit;
    }
    var clearButton = document.getElementById("clear-button");
    clearButton.disabled = !hasContent;
    var recentButton = document.getElementById("recent-button");
    recentButton.disabled = !(hasFocus && settings.recentUnits.length > 0);
}

// create unit controllers
var fromController = new UnitController("from-editor", "from-status");
var toController = new UnitController("to-editor", "to-status");
var activeController = fromController;

function NumController(numEditId, otherNumEditId, unitControl, otherControl) {
    // Class to store and control number editors
    this.numEdit = document.getElementById(numEditId);
    this.otherNumEdit = document.getElementById(otherNumEditId);
    this.unitGroup = unitControl.unitGroup;
    this.otherGroup = otherControl.unitGroup;
    this.numEdit.value = 1;
    var that = this;
    this.numEdit.oninput = function() {
        that.handleChange();
    }
    this.numEdit.onfocus = function() {
        // focus on number editors eliminates unit text editor activity
        if (activeController) {
            activeController.setButtonsEnabled(false, false, false);
            activeController = null;
            unitData.filterUnits("");
        }
    }
}
NumController.prototype.handleChange = function() {
    // do the conversion based on a number editor change
    this.otherNumEdit.value = this.convert(this.cleanNumInput());
    activeNumControl = this;
}
NumController.prototype.updateFormat = function() {
    // update the number format of the other num editor
    var num = Number(this.otherNumEdit.value);
    this.otherNumEdit.value = this.formatNumber(num);
}
NumController.prototype.cleanNumInput = function() {
    // return an evaluated numeric expression from the number editor
    var value = this.numEdit.value;
    var cleanValue = value.replace(/[^\d\. eE\+\-\*\/\(\)]/g, "");
    if (value !== cleanValue) this.numEdit.value = cleanValue;
    try {
        return Number(eval(cleanValue));
    }
    catch (e) {
        return NaN;
    }
}
NumController.prototype.convert = function(num) {
    // return the result of the conversion
    if (this.unitGroup.linear) {
        num *= this.unitGroup.factor;
    } else {
        num = this.unitGroup.nonLinearCalc(num, true) * this.unitGroup.factor;
    }
    if (this.otherGroup.linear) {
        num /= this.otherGroup.factor;
    } else {
        num = this.otherGroup.nonLinearCalc(num / this.otherGroup.factor,
                                            false);
    }
    return this.formatNumber(num);
}
NumController.prototype.formatNumber = function(num) {
    // return num formatted based on settings
    var numStr = "";
    if (settings.resultDisplay == "short") {
        if (Math.abs(num) >= 1e7 || (Math.abs(num) <= 1e-8 && num != 0)) {
            numStr = num.toExponential(settings.numDecPlaces);
            numStr = numStr.replace(/0+e/, "e");
            numStr = numStr.replace(/\.e/, "e");
        } else {
            numStr = Number(num.toFixed(settings.numDecPlaces)).toString();
        }
    } else if (settings.resultDisplay == "scientific") {
        numStr = num.toExponential(settings.numDecPlaces);
    } else if (settings.resultDisplay == "fixed") {
        if (Math.abs(num) >= 1e7 || (Math.abs(num) <= 1e-8 && num != 0)) {
            numStr = num.toExponential(settings.numDecPlaces);
        } else {
            numStr = num.toFixed(settings.numDecPlaces);
        }
    } else {  // engineering
        if (num != 0) {
            var exp = Math.floor(Math.log(Math.abs(num)) / Math.log(10));
            exp = 3 * Math.floor(exp / 3);
        } else {
            exp = 0;
        }
        num = num / Math.pow(10, exp);
        num = Math.round(num * Math.pow(10, settings.numDecPlaces)) /
                Math.pow(10, settings.numDecPlaces);
        if (Math.abs(num) >= 1000) {
            num /= 1000;
            exp += 3;
        }
        var expStr = exp.toString();
        if (expStr >= 0) expStr = "+" + expStr;
        numStr = num.toFixed(settings.numDecPlaces) + "e" + expStr;
    }
    return numStr;
}
NumController.prototype.setEnabled = function(enable) {
    // enable or disable both number editors
    this.numEdit.disabled = !enable;
    this.otherNumEdit.disabled = !enable;
}

// create number editor controllers
var fromNumController = new NumController("from-num", "to-num", fromController,
                                          toController);
var toNumController = new NumController("to-num", "from-num", toController,
                                        fromController);
var activeNumControl = fromNumController;
activeNumControl.updateFormat();
settings.restoreRecentUnits();
settings.loadRecentUnits();

updateConversion();

function updateConversion() {
    // update the status output message, enable/disable the num editors and
    // update the conversion value
    var output = "";
    var fromUnitGroup = fromController.unitGroup;
    var toUnitGroup = toController.unitGroup;
    if (!fromUnitGroup.valid || !toUnitGroup.valid) {
        output = "Set units";
        fromNumController.setEnabled(false);
    } else if (fromUnitGroup.categoryMatch(toUnitGroup)) {
        output = "Converting...";
        fromNumController.setEnabled(true);
        activeNumControl.handleChange();
        settings.addRecentUnit(toController.editor.value);
        settings.addRecentUnit(fromController.editor.value);
    } else {
        output = "Units are not compatible (" + fromUnitGroup.compatStr() +
                 " vs. " + toUnitGroup.compatStr() + ")";
        fromNumController.setEnabled(false);
    }
    document.getElementById("status-line").innerHTML = output;
}

function updateFocus() {
    // send focus back to active editor
    if (activeController) {
        activeController.editor.focus();
    } else if (activeNumControl) {
        activeNumControl.numEdit.focus();
    }
}

function addUnitText(elem) {
    // add power or operator to units based on a button click
    unitData.selectHighlight();
    var text = elem.value;
    if (text.slice(0, 1) == "^") {
        activeController.unitGroup.setCurrentExp(parseInt(text.slice(1)));
    } else {
        activeController.unitGroup.addOperator(text);
    }
    activeController.updateStatus();
    activeController.editor.focus();
}

function clearUnitText() {
    // clear text from the current unit editor
    activeController.setNewText("");
    activeController.editor.focus();
}

var recentMenu = document.getElementById("recent-menu");
var filterMenu = document.getElementById("filter-menu");
var recentButton = document.getElementById("recent-button");
var filterButton = document.getElementById("filter-button");

window.onclick = function(event) {
    // hide pull-down menus and dialogs on mouse clicks
    if (event.target != recentButton) recentMenu.style.display = "none";
    if (event.target != filterButton) filterMenu.style.display = "none";
    if (event.target == settings.dialogContainer) {
        settings.hideOptions();
    } else if (event.target == aboutDialogContainer) {
        hideAbout();
    } else if (event.target == tipDialogContainer) {
        hideTip();
    }
    if (["DIV", "FORM", "HTML"].indexOf(event.target.tagName) >= 0) {
        updateFocus();
    }
}

window.onkeydown = function(event) {
    // hide recent and filter pull-down menus on keyboard events
    recentMenu.style.display = "none";
    filterMenu.style.display = "none";
}

function showRecentUnits() {
    // toggle display of menu list of recently used units
    if (recentMenu.style.display != "block") {
        recentMenu.innerHTML = settings.recentEntries();
        recentMenu.style.display = "block";
    } else {
        recentMenu.style.display = "none";
        updateFocus();
    }
}

function addRecentUnit(elem) {
    // add recent unit to editor based on menu click
    activeController.setNewText(elem.innerHTML);
    activeController.editor.focus();
}

function showFilters() {
    // toggle display of menu list of unit types for filters
    if (filterButton.innerHTML == "Clear Filter") {
        unitData.typeFilter = "";
        var searchString = "";
        if (activeController) {
            searchString = activeController.unitGroup.currentUnitName();
        }
        unitData.filterUnits(searchString);
        filterButton.innerHTML = "Filter List";
        updateFocus();
    } else if (filterMenu.style.display != "block") {
        if (filterMenu.innerHTML.length == 0) {
            filterMenu.innerHTML = unitData.typeEntries();
        }
        filterMenu.style.display = "block";
    } else {
        filterMenu.style.display = "none";
        updateFocus();
    }
}

function showHelp() {
    // open a link to the help document
    window.open("ca_help.html", "_blank");
    updateFocus();
}

var aboutDialogContainer = document.getElementById("about-dialog");
function showAbout() {
    // show the about dialog
    document.getElementById("version").innerHTML = version;
    document.getElementById("author").innerHTML = author;
    aboutDialogContainer.style.display = "block";
}
function hideAbout() {
    // hide the about dialog
    aboutDialogContainer.style.display = "none";
    updateFocus();
}

var tipDialogContainer = document.getElementById("tip-dialog");
if (settings.showStartTip) showTip();
function showTip() {
    // show the tip dialog
    tipDialogContainer.style.display = "block";
}
function hideTip() {
    // hide the tip dialog
    if (!document.getElementById("show-tip-box").checked) {
        settings.showStartTip = false;
        settings.saveOptions();
    }
    tipDialogContainer.style.display = "none";
    updateFocus();
}
