/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ListRenderer } from "@web/views/list/list_renderer";
import { useBus, useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { useSortable } from "@web/core/utils/sortable_owl";
import { useBounceButton } from "@web/views/view_hook";
import { localization } from "@web/core/l10n/localization";
import { useComponent, useEffect, useExternalListener } from "@odoo/owl";
import { useDebounced } from "@web/core/utils/timing";
import { exprToBoolean } from "@web/core/utils/strings";
import { browser } from "@web/core/browser/browser";
import { getActiveHotkey } from "@web/core/hotkeys/hotkey_service";
import { user } from "@web/core/user";
import {
    Component,
    onMounted,
    onPatched,
    onWillPatch,
    onWillRender,
    useRef,
} from "@odoo/owl";

const DEFAULT_MIN_WIDTH = 80;
const SELECTOR_WIDTH = 20;
const DELETE_BUTTON_WIDTH = 12;
const FIELD_WIDTHS = {
    boolean: [20, 100], // [minWidth, maxWidth]
    char: [80], // only minWidth, no maxWidth
    date: 80, // minWidth = maxWidth
    datetime: 145,
    float: 93,
    integer: 71,
    many2many: [80],
    many2one_reference: [80],
    many2one: [80],
    monetary: 105,
    one2many: [80],
    reference: [80],
    selection: [80],
    text: [80, 1200],
};


patch(ListRenderer.prototype, {
	setup(){
		super.setup()
		this.uiService = useService("ui");
        this.notificationService = useService("notification");
        const key = this.createViewKey();
        this.keyOptionalFields = `optional_fields,${key}`;
        this.keyDebugOpenView = `debug_open_view,${key}`;
        this.cellClassByColumn = {};
        this.groupByButtons = this.props.archInfo.groupBy.buttons;
        useExternalListener(document, "click", this.onGlobalClick.bind(this));
        this.tableRef = useRef("table");

        this.longTouchTimer = null;
        this.touchStartMs = 0;

        /**
         * When resizing columns, it's possible that the pointer is not above the resize
         * handle (by some few pixel difference). During this scenario, click event
         * will be triggered on the column title which will reorder the column.
         * Column resize that triggers a reorder is not a good UX and we prevent this
         * using the following state variables: `resizing` and `preventReorder` which
         * are set during the column's click (onClickSortColumn), pointerup
         * (onColumnTitleMouseUp) and onStartResize events.
         */
        this.preventReorder = false;

        this.creates = this.props.archInfo.creates.length
            ? this.props.archInfo.creates
            : [{ type: "create", string: _t("Add a line") }];

        this.cellToFocus = null;
        this.activeRowId = null;
        onMounted(async () => {
            // Due to the way elements are mounted in the DOM by Owl (bottom-to-top),
            // we need to wait the next micro task tick to set the activeElement.
            await Promise.resolve();
            this.activeElement = this.uiService.activeElement;
        });
        onWillPatch(() => {
            const activeRow = document.activeElement.closest(".o_data_row.o_selected_row");
            this.activeRowId = activeRow ? activeRow.dataset.id : null;
        });
        this.optionalActiveFields = this.props.optionalActiveFields || {};
        this.allColumns = [];
        this.columns = [];
        onWillRender(() => {
            this.allColumns = this.processAllColumn(this.props.archInfo.columns, this.props.list);
            Object.assign(this.optionalActiveFields, this.computeOptionalActiveFields());
            this.debugOpenView = exprToBoolean(browser.localStorage.getItem(this.keyDebugOpenView));
            this.columns = this.getActiveColumns(this.props.list);
            this.withHandleColumn = this.columns.some((col) => col.widget === "handle");
        });
        let dataRowId;
        this.rootRef = useRef("root");
        this.resequencePromise = Promise.resolve();
        useSortable({
            enable: () => this.canResequenceRows,
            // Params
            ref: this.rootRef,
            elements: ".o_row_draggable",
            handle: ".o_handle_cell",
            cursor: "grabbing",
            // Hooks
            onDragStart: (params) => {
                const { element } = params;
                dataRowId = element.dataset.id;
                return this.sortStart(params);
            },
            onDragEnd: (params) => this.sortStop(params),
            onDrop: (params) => this.sortDrop(dataRowId, params),
        });

        if (this.env.searchModel) {
            useBus(this.env.searchModel, "focus-view", () => {
                if (this.props.list.model.useSampleModel) {
                    return;
                }

                const nextTh = this.tableRef.el.querySelector("thead th");
                const toFocus = getElementToFocus(nextTh);
                this.focus(toFocus);
                this.tableRef.el.querySelector("tbody").classList.add("o_keyboard_navigation");
            });
        }

        useBus(this.props.list.model.bus, "FIELD_IS_DIRTY", (ev) => (this.lastIsDirty = ev.detail));

        useBounceButton(this.rootRef, () => {
            return this.showNoContentHelper;
        });

        let isSmall = this.uiService.isSmall;
        useBus(this.uiService.bus, "resize", () => {
            if (isSmall !== this.uiService.isSmall) {
                isSmall = this.uiService.isSmall;
                this.render();
            }
        });
        const resModel = this.props.list.resModel
        this.columnWidths = useMagicColumnWidthsInherit(this.tableRef, () => {
            return {
                columns: this.columns,
                isEmpty: !this.props.list.records.length || this.props.list.model.useSampleModel,
                hasSelectors: this.hasSelectors,
                hasOpenFormViewColumn: this.hasOpenFormViewColumn,
                hasActionsColumn: this.hasActionsColumn,
            };
        }, resModel);

        useExternalListener(window, "keydown", (ev) => {
            this.shiftKeyMode = ev.shiftKey;
        });
        useExternalListener(window, "keyup", (ev) => {
            this.shiftKeyMode = ev.shiftKey;
            const hotkey = getActiveHotkey(ev);
            if (hotkey === "shift") {
                this.shiftKeyedRecord = undefined;
            }
        });
        useExternalListener(window, "blur", (ev) => {
            this.shiftKeyMode = false;
        });
        onPatched(async () => {
            // HACK: we need to wait for the next tick to be sure that the Field components are patched.
            // OWL don't wait the patch for the children components if the children trigger a patch by himself.
            await Promise.resolve();

            if (this.activeElement !== this.uiService.activeElement) {
                return;
            }
            const editedRecord = this.props.list.editedRecord;
            if (editedRecord && this.activeRowId !== editedRecord.id) {
                if (this.cellToFocus && this.cellToFocus.record === editedRecord) {
                    const column = this.cellToFocus.column;
                    const forward = this.cellToFocus.forward;
                    this.focusCell(column, forward);
                } else if (this.lastEditedCell) {
                    this.focusCell(this.lastEditedCell.column, true);
                } else {
                    this.focusCell(this.columns[0]);
                }
            }
            this.cellToFocus = null;
            this.lastEditedCell = null;
        });
        this.isRTL = localization.direction === "rtl";

	}

});

//overwritten useMagicColumnWidths
export function useMagicColumnWidthsInherit(tableRef, getState, resModel) {
    const renderer = useComponent();
    let columnWidths = null;
    let allowedWidth = 0;
    let hasAlwaysBeenEmpty = true;
    let hash;
    let _resizing = false;

    /**
     * Apply the column widths in the DOM. If necessary, compute them first (e.g. if they haven't
     * been computed yet, or if columns have changed).
     *
     * Note: the following code manipulates the DOM directly to avoid having to wait for a
     * render + patch which would occur on the next frame and cause flickering.
     */
    function forceColumnWidths(resModel) {
        const table = tableRef.el;
        const headers = [...table.querySelectorAll("thead th")];
        const state = getState();

        // Generate a hash to be able to detect when the columns change
        const columns = state.columns;
        // The last part of the hash is there to detect that static columns changed (typically, the
        // selector column, which isn't displayed on small screens)
        const nextHash = `${columns.map((column) => column.id).join("/")}/${headers.length}`;
        if (nextHash !== hash) {
            hash = nextHash;
            resetWidths();
        }
        // If the table has always been empty until now, and it now contains records, we want to
        // recompute the widths based on the records (typical case: we removed a filter).
        // Exception: we were in an empty editable list, and we just added a first record.
        if (hasAlwaysBeenEmpty && !state.isEmpty) {
            hasAlwaysBeenEmpty = false;
            const rows = table.querySelectorAll(".o_data_row");
            if (rows.length !== 1 || !rows[0].classList.contains("o_selected_row")) {
                resetWidths();
            }
        }

        const parentPadding = getHorizontalPadding(table.parentNode);
        const cellPaddings = headers.map((th) => getHorizontalPadding(th));
        const totalCellPadding = cellPaddings.reduce((total, padding) => padding + total, 0);
        const nextAllowedWidth = table.parentNode.clientWidth - parentPadding - totalCellPadding;
        const allowedWidthDiff = Math.abs(allowedWidth - nextAllowedWidth);
        allowedWidth = nextAllowedWidth;

        // When a vertical scrollbar appears/disappears, it may (depending on the browser/os) change
        // the available width. When it does, we want to keep the current widths, but tweak them a
        // little bit s.t. the table fits in the new available space.
        if (!columnWidths || allowedWidthDiff > 0) {
            columnWidths = computeWidths(table, state, allowedWidth, columnWidths, resModel);
        }

        // Set the computed widths in the DOM.
        table.style.tableLayout = "fixed";
        headers.forEach((th, index) => {
            th.style.width = `${Math.floor(columnWidths[index] + cellPaddings[index])}px`;
        });
    }

    /**
     * Resets the widths. After next patch, ideal widths will be recomputed.
     */
    function resetWidths() {
        columnWidths = null;
        // Unset width that might have been set on the table by resizing a column
        tableRef.el.style.width = null;
    }

    /**
     * Handles the resize feature on the column headers
     *
     * @private
     * @param {MouseEvent} ev
     */
    function onStartResize(ev) {
        _resizing = true;
        const table = tableRef.el;
        const th = ev.target.closest("th");
        const handler = th.querySelector(".o_resize");
        table.style.width = `${Math.floor(table.getBoundingClientRect().width)}px`;
        const thPosition = [...th.parentNode.children].indexOf(th);
        const resizingColumnElements = [...table.getElementsByTagName("tr")]
            .filter((tr) => tr.children.length === th.parentNode.children.length)
            .map((tr) => tr.children[thPosition]);
        const initialX = ev.clientX;
        const initialWidth = th.getBoundingClientRect().width;
        const initialTableWidth = table.getBoundingClientRect().width;
        const resizeStoppingEvents = ["keydown", "pointerdown", "pointerup"];

        // Fix the width so that if the resize overflows, it doesn't affect the layout of the parent
        if (!table.parentElement.style.width) {
            table.parentElement.style.width = `${Math.floor(
                table.parentElement.getBoundingClientRect().width
            )}px`;
        }

        // Apply classes to table and selected column
        table.classList.add("o_resizing");
        for (const el of resizingColumnElements) {
            el.classList.add("o_column_resizing");
            handler.classList.add("bg-primary", "opacity-100");
            handler.classList.remove("bg-black-25", "opacity-50-hover");
        }
        // Mousemove event : resize header
        const resizeHeader = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const delta = ev.clientX - initialX;
            const newWidth = Math.max(10, initialWidth + delta);
            const tableDelta = newWidth - initialWidth;
            th.style.width = `${Math.floor(newWidth)}px`;
            table.style.width = `${Math.floor(initialTableWidth + tableDelta)}px`;
        };
        window.addEventListener("pointermove", resizeHeader);

        // Mouse or keyboard events : stop resize
        const stopResize = (ev) => {
            _resizing = false;

            // Store current column widths to freeze them
            const headers = [...table.querySelectorAll("thead th")];
            columnWidths = headers.map((th) => {
                return th.getBoundingClientRect().width - getHorizontalPadding(th);
            });

            // Ignores the 'left mouse button down' event as it used to start resizing
            if (ev.type === "pointerdown" && ev.button === 0) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();

            table.classList.remove("o_resizing");
            for (const el of resizingColumnElements) {
                el.classList.remove("o_column_resizing");
                handler.classList.remove("bg-primary", "opacity-100");
                handler.classList.add("bg-black-25", "opacity-50-hover");
            }

            window.removeEventListener("pointermove", resizeHeader);
            for (const eventType of resizeStoppingEvents) {
                window.removeEventListener(eventType, stopResize);
            }

            // We remove the focus to make sure that the there is no focus inside
            // the tr.  If that is the case, there is some css to darken the whole
            // thead, and it looks quite weird with the small css hover effect.
            document.activeElement.blur();
        };
        // We have to listen to several events to properly stop the resizing function. Those are:
        // - pointerdown (e.g. pressing right click)
        // - pointerup : logical flow of the resizing feature (drag & drop)
        // - keydown : (e.g. pressing 'Alt' + 'Tab' or 'Windows' key)
        for (const eventType of resizeStoppingEvents) {
            window.addEventListener(eventType, stopResize);
        }


		if (!th || th.tagName !== "TH") {
		    return;
		}
        const saveWidth = (saveWidthEv) => {
            if (saveWidthEv.type === "mousedown" && saveWidthEv.which === 1) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            const fieldName = th ? th.getAttribute('data-name') : undefined;
            if (this.props.list.resModel && fieldName && browser.localStorage) {
                browser.localStorage.setItem(
                    "odoo.columnWidth." + this.props.list.resModel + "." + fieldName,
                    parseInt((th.style.width || "0").replace("px", ""), 10) || 0
                );
            }
            for (const eventType of resizeStoppingEvents) {
                browser.removeEventListener(eventType, saveWidth);
            }
            document.activeElement.blur();
        };
        for (const eventType of resizeStoppingEvents) {
            browser.addEventListener(eventType, saveWidth);
        }


    }

    // Side effects
    if (renderer.constructor.useMagicColumnWidths) {
        useEffect(() => {
		    const initialModalName = resModel;
		    forceColumnWidths(initialModalName); // Pass initial modal name here
		});
        const debouncedResizeCallback = useDebounced(() => {
            resetWidths();
            forceColumnWidths(resModel);
        }, 200);
        useExternalListener(window, "resize", debouncedResizeCallback);
    }

    // API
    return {
        get resizing() {
            return _resizing;
        },
        onStartResize,
    };
}

//required for useMagicColumnWidthsInherit
//no changes made
function getHorizontalPadding(el) {
    const { paddingLeft, paddingRight } = getComputedStyle(el);
    return parseFloat(paddingLeft) + parseFloat(paddingRight);
}

function computeWidths(table, state, allowedWidth, startingWidths, resModel) {
    let _columnWidths;
    const headers = [...table.querySelectorAll("thead th")];
    const columns = state.columns;

    // Starting point: compute widths
    if (startingWidths) {
        _columnWidths = startingWidths.slice();
    } else if (state.isEmpty) {
        // Table is empty => uniform distribution as starting point
        _columnWidths = headers.map(() => allowedWidth / headers.length);
    } else {
        // Table contains records => let the browser compute ideal widths
        // Set table layout auto and remove inline style
        table.style.tableLayout = "auto";
        headers.forEach((th) => {
            th.style.width = null;
        });
        // Toggle a className used to remove style that could interfere with the ideal width
        // computation algorithm (e.g. prevent text fields from being wrapped during the
        // computation, to prevent them from being completely crushed)
        table.classList.add("o_list_computing_widths");
        _columnWidths = headers.map((th) => th.getBoundingClientRect().width);
        table.classList.remove("o_list_computing_widths");
    }

    // Force columns to comply with their min and max widths
    if (state.hasSelectors) {
        _columnWidths[0] = SELECTOR_WIDTH;
    }
    if (state.hasOpenFormViewColumn) {
        const index = _columnWidths.length - (state.hasActionsColumn ? 2 : 1);
        _columnWidths[index] = OPEN_FORM_VIEW_BUTTON_WIDTH;
    }
    if (state.hasActionsColumn) {
        _columnWidths[_columnWidths.length - 1] = DELETE_BUTTON_WIDTH;
    }
    const columnWidthSpecs = getWidthSpecs(columns);
    const columnOffset = state.hasSelectors ? 1 : 0;
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
        const thIndex = columnIndex + columnOffset;
        const { minWidth, maxWidth } = columnWidthSpecs[columnIndex];
        if (_columnWidths[thIndex] < minWidth) {
            _columnWidths[thIndex] = minWidth;
        } else if (maxWidth && _columnWidths[thIndex] > maxWidth) {
            _columnWidths[thIndex] = maxWidth;
        }
    }

    // Expand/shrink columns for the table to fill 100% of available space
    const totalWidth = _columnWidths.reduce((tot, width) => tot + width, 0);
    let diff = totalWidth - allowedWidth;
    if (diff >= 1) {
        // Case 1: table overflows its parent => shrink some columns
        const shrinkableColumns = [];
        let totalAvailableSpace = 0; // total space we can gain by shrinking columns
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
            const thIndex = columnIndex + columnOffset;
            const { minWidth, canShrink } = columnWidthSpecs[columnIndex];
            if (_columnWidths[thIndex] > minWidth && canShrink) {
                shrinkableColumns.push({ thIndex, minWidth });
                totalAvailableSpace += _columnWidths[thIndex] - minWidth;
            }
        }
        if (diff > totalAvailableSpace) {
            // We can't find enough space => set all columns to their min width, and there'll be an
            // horizontal scrollbar
            for (const { thIndex, minWidth } of shrinkableColumns) {
                _columnWidths[thIndex] = minWidth;
            }
        } else {
            // There's enough available space among shrinkable columns => shrink them uniformly
            let remainingColumnsToShrink = shrinkableColumns.length;
            while (diff >= 1) {
                const colDiff = diff / remainingColumnsToShrink;
                for (const { thIndex, minWidth } of shrinkableColumns) {
                    const currentWidth = _columnWidths[thIndex];
                    if (currentWidth === minWidth) {
                        continue;
                    }
                    const newWidth = Math.max(currentWidth - colDiff, minWidth);
                    diff -= currentWidth - newWidth;
                    _columnWidths[thIndex] = newWidth;
                    if (newWidth === minWidth) {
                        remainingColumnsToShrink--;
                    }
                }
            }
        }
    } else if (diff <= -1) {
        // Case 2: table is narrower than its parent => expand some columns
        diff = -diff; // for better readability
        const expandableColumns = [];
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
            const thIndex = columnIndex + columnOffset;
            const maxWidth = columnWidthSpecs[columnIndex].maxWidth;
            if (!maxWidth || _columnWidths[thIndex] < maxWidth) {
                expandableColumns.push({ thIndex, maxWidth });
            }
        }
        // Expand all expandable columns uniformly (i.e. at most, expand columns with a maxWidth
        // to their maxWidth)
        let remainingExpandableColumns = expandableColumns.length;
        while (diff >= 1 && remainingExpandableColumns > 0) {
            const colDiff = diff / remainingExpandableColumns;
            for (const { thIndex, maxWidth } of expandableColumns) {
                const currentWidth = _columnWidths[thIndex];
                const newWidth = Math.min(currentWidth + colDiff, maxWidth || Number.MAX_VALUE);
                diff -= newWidth - currentWidth;
                _columnWidths[thIndex] = newWidth;
                if (newWidth === maxWidth) {
                    remainingExpandableColumns--;
                }
            }
        }
        if (diff >= 1) {
            // All columns have a maxWidth and have been expanded to their max => expand them more
            for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
                const thIndex = columnIndex + columnOffset;
                _columnWidths[thIndex] += diff / columns.length;
            }
        }
    }

    const thElements = [...table.querySelectorAll("thead th")];
    thElements.forEach((el, elIndex) => {
        const fieldName = el.getAttribute("data-name");
        if (
            !el.classList.contains("o_list_button") &&
            resModel &&
            fieldName &&
            browser.localStorage
        ) {
            const storedWidth = browser.localStorage.getItem(
                `odoo.columnWidth.${resModel}.${fieldName}`
            );
            if (storedWidth) {
                _columnWidths[elIndex] = parseInt(storedWidth, 10);
            }
        }
    });

    return _columnWidths;
}

//required for useMagicColumnWidthsInherit
//no changes made
function getWidthSpecs(columns) {
    return columns.map((column) => {
        let minWidth;
        let maxWidth;
        if (column.options && column.attrs.width) {
            minWidth = maxWidth = parseInt(column.attrs.width.split("px")[0]);
        } else {
            let width;
            if (column.type === "field") {
                if (column.field.listViewWidth) {
                    width = column.field.listViewWidth;
                    if (typeof width === "function") {
                        width = width({ type: column.fieldType, hasLabel: column.hasLabel });
                    }
                } else {
                    width = FIELD_WIDTHS[column.widget || column.fieldType];
                }
            } else if (column.type === "widget") {
                width = column.widget.listViewWidth;
            }
            if (width) {
                minWidth = Array.isArray(width) ? width[0] : width;
                maxWidth = Array.isArray(width) ? width[1] : width;
            } else {
                minWidth = DEFAULT_MIN_WIDTH;
            }
        }
        return { minWidth, maxWidth, canShrink: column.type === "field" };
    });
}

//required for useMagicColumnWidthsInherit
//no changes made
function getWidthSpecs(columns) {
    return columns.map((column) => {
        let minWidth;
        let maxWidth;
        if (column.options && column.attrs.width) {
            minWidth = maxWidth = parseInt(column.attrs.width.split("px")[0]);
        } else {
            let width;
            if (column.type === "field") {
                if (column.field.listViewWidth) {
                    width = column.field.listViewWidth;
                    if (typeof width === "function") {
                        width = width({ type: column.fieldType, hasLabel: column.hasLabel });
                    }
                } else {
                    width = FIELD_WIDTHS[column.widget || column.fieldType];
                }
            } else if (column.type === "widget") {
                width = column.widget.listViewWidth;
            }
            if (width) {
                minWidth = Array.isArray(width) ? width[0] : width;
                maxWidth = Array.isArray(width) ? width[1] : width;
            } else {
                minWidth = DEFAULT_MIN_WIDTH;
            }
        }
        return { minWidth, maxWidth, canShrink: column.type === "field" };
    });
}