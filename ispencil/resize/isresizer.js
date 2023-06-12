// isresizer.js

import { Template } from '@ckeditor/ckeditor5-ui';
import { Rect, ObservableMixin, compareArrays } from '@ckeditor/ckeditor5-utils';
import IsResizeState from './isresizerstate';
// import './theme/isresizehandles.css';

export default class IsResizer extends ObservableMixin() {
    constructor(options) {
        super();

        console.log('IsResizer#constructor with options', options);

        /**
         * Options passed to the {@link #constructor}.
         * Options are built in IsResize#
         *
         */
        this._options = options;

        /**
         * Flag that indicates whether resizer can be used.
         *
         * @observable
         */
        this.set('isEnabled', true);

        /**
         * Flag that indicates that resizer is currently focused.
         *
         * @observable
         */
        this.set('isSelected', false);

        /**
         * Flag that indicates whether resizer is rendered (visible on the screen).
         *
         * @readonly
         * @observable
         */
        this.bind('isVisible').to(this, 'isEnabled', this, 'isSelected', (isEnabled, isSelected) => isEnabled && isSelected);
        // Turns the given methods of this object into event-based ones. 
        // This means that the new method will fire an event (named after the method)
        // and the original action will be plugged as a listener to that event.
        this.decorate('begin');
    }

    get state() {
        return this._state;
    }

    /**
     * DOM container of the entire resize UI.
     *
     * Note that this property will have a value only after the element bound with the resizer is rendered
     * (otherwise `null`).
     *
     * @private
     * @member {HTMLElement|null}
     */
    get _resizerDomElement() {
        return this._options.editor.editing.view.domConverter.mapViewToDom(this._resizerViewElement);
    }

    /**
     * Returns one of 'left' 'center', 'right' or null
     */
    get _widgetPosition() {
        const widgetViewElement = this._options.widgetViewElement;
        if (widgetViewElement.hasClass( 'ispcl-leftpos' )) {
            return 'left';
        } else if (widgetViewElement.hasClass( 'ispcl-centerpos' )) {
            return 'center';
        } else if (widgetViewElement.hasClass( 'ispcl-rightpos' )) {
            return 'right';
        } else {
            return null;
        }
    }

    attach() {
        console.log('IsResizer#attach with options', this._options);
        const that = this;
        const widgetViewElement = this._options.widgetViewElement;
        const editingView = this._options.editor.editing.view;
        editingView.change(writer => {
            console.log( 'IsResizer editingView change going to execute' );
            const resizerViewElement = writer.createUIElement('div', {
                class: 'ck ck-reset_all ck-widget__resizer'
            }, function (domDocument) {
                const domElement = this.toDomElement(domDocument);
                console.log( 'IsResizer#attach that._appendHandles to domElement', domElement );
                that._appendHandles(domElement);
                return domElement;
            });
            console.log( 'IsResizer#attach created viewResizerWarapper', resizerViewElement );
            // Append the resizer wrapper to the widget's wrapper.
            writer.insert(writer.createPositionAt(widgetViewElement, 'end'), resizerViewElement);
            writer.addClass('ck-widget_with-resizer', widgetViewElement);
            // Note that this would refer to a property of esitingView
            that._resizerViewElement = resizerViewElement;
            console.log( 'IsResizer#attach end of editingView.change' );
            if (!this.isVisible) {
                this.hide();
                console.log( 'IsResizer#attach just hided' );
            }
        });
        this.on('change:isVisible', () => {
            if (this.isVisible) {
                this.show();
                this.redraw();
            }
            else {
                this.hide();
            }
        });
        console.log( 'IsResize#attach end' );
    }

    /**
     * Starts the resizing process.
     * By this.decorate('begin') this method fires an event 'begin' and the code below is a listener to the 'begin' event
     *
     * Creates a new {@link #state} for the current process.
     *
     * @fires begin
     * @param {HTMLElement} domResizeHandle Clicked handle.
     */
    begin(domResizeHandle) {
        this._state = new IsResizeState(this._options);
        console.log('begin with domResizeHandle', domResizeHandle);
        this._initialWidgetViewWidth = this._options.widgetViewElement.getStyle('width');
        this._initialWidgetViewHeight = this._options.widgetViewElement.getStyle('height');
        this.state.begin(domResizeHandle, this._getWidgetDomElement());
    }

    /**
     * Updates the proposed size based on `domEventData`.
     *
     * @fires updateSize
     * @param {Event} domEventData
     */
    updateSize(domEventData) {
        console.log( 'updateSize' );
        const newSize = this._proposeNewSize(domEventData);
        const editingView = this._options.editor.editing.view;
        editingView.change(writer => {
            writer.setStyle(newSize, this._options.widgetViewElement);
        });
        const domHandleHost = this._getWidgetDomElement();
        const domHandleHostRect = new Rect(domHandleHost);
        // Handle max-width limitation.
        const domResizeHostRect = new Rect(domHandleHost);
        newSize.width = Math.round(domResizeHostRect.width);
        newSize.height = Math.round(domResizeHostRect.height);
        this.redraw(domHandleHostRect);

        this.state.update({
            ...newSize
        });
    }

    /**
     * Applies to the canvas the geometry proposed by the resizer.
     *
     * @fires commit
     */
    commit() {
        const newWidth = this.state.proposedWidth;
        const newHeight = this.state.proposedHeight;
        // Both cleanup and onCommit callback are very likely to make view changes. Ensure that it is made in a single step.
        this._options.editor.editing.view.change(() => {
            this._cleanup();
            // console.log('IsResizer#commit calling this._options.onCommit', this._options );
            // this._options.onCommit(newValue); // Probably superfluous

            const newSize = {
                width: newWidth,
                height: newHeight
            }
            const editor = this._options.editor;
            editor.execute( 'isPencilSizeCommand', newSize );

        });
    }

    /**
     * Makes resizer visible in the UI.
     */
    show() {
        const editingView = this._options.editor.editing.view;
        editingView.change(writer => {
            writer.removeClass('ck-hidden', this._resizerViewElement);
        });
        this.setHandleVisibility();
    }

    /**
     * Hides resizer in the UI.
     */
    hide() {
        const editingView = this._options.editor.editing.view;
        editingView.change(writer => {
            writer.addClass('ck-hidden', this._resizerViewElement);
        });
    }

    /**
     * Sets all handles to visible, by remowing the 'ck-hidden' class and then selectively hides
     * bottom-left handle for left floating and
     * bottom-right for right floating widgets
     */
    setHandleVisibility() {
        if (this._resizerDomElement) {
            // Establish the default, by removing all handle hiding
            const children = this._resizerDomElement.childNodes;
            for (let handle of children) {
                handle.classList.remove('ck-hidden');
            }
            let hclass = null;
            // Get the position of the widget
            if  ( this._widgetPosition == 'left') {
                // Hide bottom-left handle
                hclass = getResizerClass( 'bottom-left' );
            } else if (this._widgetPosition == 'right') {
                // Hide bottom-right handle
                hclass = getResizerClass( 'bottom-right' );
            }
            if (hclass) {
                const children = this._resizerDomElement.childNodes;
                for (let handle of children) {
                    if (handle.classList.contains(hclass)) {
                        handle.classList.add('ck-hidden');
                    }
                }
            }
        }
    }

    /**
     * Cancels and rejects the proposed resize dimensions, hiding the UI.
     *
     * @fires cancel
     */
    cancel() {
        this._cleanup();
    }

    /**
     * Destroys the resizer.
     */
    destroy() {
        this.cancel();
    }

    /**
     * Redraws the resizer.
     *
     * @param {module:utils/dom/rect~Rect} [handleHostRect] Handle host rectangle might be given to improve performance.
     */
    redraw(handleHostRect) {
        // console.log('IsResizer#redraw begin');
        // resizerDomElement is the DOM container of the entire resize UI. It is reeturned by the getter this.get _resizerDomElement().
        // It is the conversion to DOM of this._resizerViewElement
        // Note that this property will have a value only after the element bound with the resizer is rendered
        // -------------
        // resizerDomElement is the special div of class ck-widget__resizer built in the editing pipeline
        const resizerDomElement = this._resizerDomElement; // Built by a getter. It is the conversion to Model of viewResizerWrapper below
        // Refresh only if resizer exists in the DOM.
        if (!existsInDom(resizerDomElement)) {
            console.log( 'IsResizer#redraw premature end due to missing resizer in DOM' );
            return;
        }
        // _resizerViewElement is defined by this.attach. It is the editing view element of the div of class ck-widget__resizer
        const resizerViewElement = this._resizerViewElement;
        const currentDimensions = [
            resizerViewElement.getStyle('width'),
            resizerViewElement.getStyle('height')
        ];
        // console.log('currentDimensions', currentDimensions);


        let newDimensions;
        const widgetDomElement = resizerDomElement.parentElement;
        const clientRect = handleHostRect || new Rect(widgetDomElement);
        newDimensions = [
            clientRect.width + 'px',
            clientRect.height + 'px'
        ];


        // Make changes to the view only if the resizer should actually get new dimensions.
        // Otherwise, if View#change() was always called, this would cause EditorUI#update
        // loops because the WidgetResize plugin listens to EditorUI#update and updates
        // the resizer.
        // https://github.com/ckeditor/ckeditor5/issues/7633
        if (compareArrays(currentDimensions, newDimensions) !== 'same') {
            this._options.editor.editing.view.change(writer => {
                writer.setStyle({
                    width: newDimensions[0],
                    height: newDimensions[1]
                }, resizerViewElement);
            });
            console.log( 'IsResizer#redraw changed dimensions in resizer' );
        }

        // console.log('IsResizer#redraw end');
    }

    containsHandle(domElement) {
        return this._resizerDomElement.contains(domElement);
    }

    static isResizeHandle(domElement) {
        return domElement.classList.contains('ck-widget__resizer__handle');
    }

    /**
     * Obtains the resize host.
     *
     * Resize host is an object that receives dimensions which are the result of resizing.
     *
     * @protected
     * @returns {HTMLElement}
     */
    _getCanvasDomElement() {
        const widgetDomElement = this._resizerDomElement.parentElement;
        return this._options.getCanvasDomElement(widgetDomElement);
    }

    /**
     * Obtains the handle host.
     *
     * Handle host is an object that the handles are aligned to.
     *
     * Handle host will not always be an entire widget itself. Take an image as an example. The image widget
     * contains an image and a caption. Only the image should be surrounded with handles.
     *
     * @protected
     * @returns {HTMLElement}
     */
    _getWidgetDomElement() {
        const widgetDomElement = this._resizerDomElement.parentElement;
        return widgetDomElement;
    }

    /**
     * Renders the resize handles in the DOM.
     *
     * @private
     * @param {HTMLElement} domElement The resizer wrapper.
     */
    _appendHandles(domElement) {
        // console.log( 'IsResizer#_appendHandles begin with domElement', domElement );
        // const resizerPositions = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
        // NOTE: We require only bottom handles
        const resizerPositions = ['bottom-right', 'bottom-left'];
        // const resizerPositions = ['top', 'bottom', 'left', 'right'];
        for (const currentPosition of resizerPositions) {
            domElement.appendChild(new Template({
                tag: 'div',
                attributes: {
                    class: `ck-widget__resizer__handle ${getResizerClass(currentPosition)}`
                }
            }).render());

            /* This was a debugging alternative
            const template = new Template({
                tag: 'div',
                attributes: {
                    class: `ck-widget__resizer__handle ${getResizerClass(currentPosition)}`
                }
            });
            // console.log(' IsResizer#_appendHandles created template ', template );
            const handle = template.render();
            domElement.appendChild( handle );
            */
        }
        // console.log(' IsResizer#_appendHandles end' );
    }

    /**
     * Cleans up the context state.
     *
     * @protected
     */
    _cleanup() {
        const editingView = this._options.editor.editing.view;
        editingView.change(writer => {
            writer.setStyle('width', this._initialWidgetViewWidth, this._options.widgetViewElement);
            writer.setStyle('height', this._initialWidgetViewHeight, this._options.widgetViewElement);
        });
    }

    /**
     * Calculates the proposed size as the resize handles are dragged.
     *
     * @private
     * @param {Event} domEventData Event data that caused the size update request. It should be used to calculate the proposed size.
     * @returns {Object} return
     * @returns {Object} return an object of proposed dimensions with properties 'width' and 'height'
     */
    _proposeNewSize(domEventData) {
        const state = this.state;
        const currentCoordinates = extractCoordinates(domEventData);
        const isCentered = this._options.isCentered ? this._options.isCentered(this) : true;
        // Enlargement defines how much the resize host has changed in a given axis. Naturally it could be a negative number
        // meaning that it has been shrunk.
        //
        // +----------------+--+
        // |                |  |
        // |       img      |  |
        // |  /handle host  |  |
        // +----------------+  | ^
        // |                   | | - enlarge y
        // +-------------------+ v
        // 					<-->
        // 					 enlarge x

        // state._referenceCoordinates
        // ===========================
        // The reference point of the resizer where the dragging started. It is used to measure the distance the user cursor
        // traveled, so how much the image should be enlarged.
        const enlargement = {
            x: state._referenceCoordinates.x - (currentCoordinates.x + state.originalWidth),
            y: (currentCoordinates.y - state.originalHeight) - state._referenceCoordinates.y
        };
        if (isCentered && state.activeHandlePosition.endsWith('-right')) {
            enlargement.x = currentCoordinates.x - (state._referenceCoordinates.x + state.originalWidth);
        }
        // Objects needs to be resized twice as much in horizontal axis if centered, since enlargement is counted from
        // one resized corner to your cursor. It needs to be duplicated to compensate for the other side too.
        if (isCentered) {
            enlargement.x *= 2;
        }
        // The size proposed by the user. It does not consider the aspect ratio.
        let width = Math.abs(state.originalWidth + enlargement.x);
        let height = Math.abs(state.originalHeight + enlargement.y);
        return {
            width: Math.round(width) + 'px',
            height: Math.round(height) + 'px'
        };
    }
}

// @private
// @param {String} resizerPosition Expected resizer position like `"top"`, `"bottomt"`.
// @returns {String} A prefixed HTML class name for the resizer element
function getResizerClass(resizerPosition) {
    // return `is-widget__resizer__handle-${resizerPosition}`;
    return `ck-widget__resizer__handle-${resizerPosition}`;
}

function extractCoordinates(event) {
    return {
        x: event.pageX,
        y: event.pageY
    };
}

function existsInDom(element) {
    return element && element.ownerDocument && element.ownerDocument.contains(element);
}