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
    get _domResizerWrapper() {
        return this._options.editor.editing.view.domConverter.mapViewToDom(this._viewResizerWrapper);
    }

    attach() {
        console.log('IsResizer#attach with options', this._options);
        const that = this;
        const widgetElement = this._options.viewElement;
        const editingView = this._options.editor.editing.view;
        editingView.change(writer => {
            console.log( 'IsResizer editingView change going to execute' );
            const viewResizerWrapper = writer.createUIElement('div', {
                class: 'ck ck-reset_all ck-widget__resizer'
            }, function (domDocument) {
                const domElement = this.toDomElement(domDocument);
                console.log( 'IsResizer#attach that._appendHandles to domElement', domElement );
                that._appendHandles(domElement);
                return domElement;
            });
            console.log( 'IsResizer#attach created viewResizerWarapper', viewResizerWrapper );
            // Append the resizer wrapper to the widget's wrapper.
            writer.insert(writer.createPositionAt(widgetElement, 'end'), viewResizerWrapper);
            writer.addClass('ck-widget_with-resizer', widgetElement);
            // Note that this would refer to a property of esitingView
            that._viewResizerWrapper = viewResizerWrapper;
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
        // this._sizeView._bindToState(this._options, this.state);
        this._initialViewWidth = this._options.viewElement.getStyle('width');
        this.state.begin(domResizeHandle, this._getHandleHost(), this._getResizeHost());
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
            /*
            const unit = this._options.unit || '%';
            const newWidth = (unit === '%' ? newSize.widthPercents : newSize.width) + unit;
            */
            writer.setStyle(newSize, this._options.viewElement);
        });
        // Get an actual image width, and:
        // * reflect this size to the resize wrapper
        // * apply this **real** size to the state
        const domHandleHost = this._getHandleHost();
        const domHandleHostRect = new Rect(domHandleHost);
        /*
        const handleHostWidth = Math.round(domHandleHostRect.width);
        const handleHostHeight = Math.round(domHandleHostRect.height);
        */
        // Handle max-width limitation.
        const domResizeHostRect = new Rect(domHandleHost);
        newSize.width = Math.round(domResizeHostRect.width);
        newSize.height = Math.round(domResizeHostRect.height);
        this.redraw(domHandleHostRect);

        /*
        this.state.update({
            ...newSize,
            handleHostWidth,
            handleHostHeight
        });
        */

        this.state.update({
            ...newSize
        });
    }

    /**
     * Applies the geometry proposed with the resizer.
     *
     * @fires commit
     */
    commit() {
        const newValue = this.state.proposedWidth;
        // Both cleanup and onCommit callback are very likely to make view changes. Ensure that it is made in a single step.
        this._options.editor.editing.view.change(() => {
            this._cleanup();
            // console.log('IsResizer#commit calling this._options.onCommit', this._options );
            // this._options.onCommit(newValue); // Probably superfluous

            // this._options.dimensionHolder is NOT the same as ths._getResizeHost
            this._options.dimensionHolder._setAttribute('width', newValue);
        });
    }

    /**
     * Makes resizer visible in the UI.
     */
    show() {
        const editingView = this._options.editor.editing.view;
        editingView.change(writer => {
            writer.removeClass('ck-hidden', this._viewResizerWrapper);
        });
    }

    /**
     * Hides resizer in the UI.
     */
    hide() {
        const editingView = this._options.editor.editing.view;
        editingView.change(writer => {
            writer.addClass('ck-hidden', this._viewResizerWrapper);
        });
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
        // domWrapper is the DOM container of the entire resize UI. It is reeturned by the getter this.get _domResizerWrapper().
        // It is the conversion to DOM of this._viewResizerWrapper
        // Note that this property will have a value only after the element bound with the resizer is rendered
        // -------------
        // domWrapper is the special div of class ck-widget__resizer built in the editing pipeline
        const domWrapper = this._domResizerWrapper; // Built by a getter. It is the conversion to Model of viewResizerWrapper below
        // console.log('domWrapper', domWrapper);
        // Refresh only if resizer exists in the DOM.
        if (!existsInDom(domWrapper)) {
            console.log( 'IsResizer#redraw premature end due to missing resizer in DOM' );
            return;
        }
        // widgetWrapper is the DOM element built to contain the widget. 
        const widgetWrapper = domWrapper.parentElement;
        // console.log('widgetWrapper', widgetWrapper);
        // const handleHost = this._getHandleHost(); // We use widgetWrapper as handleHost
        // console.log('handleHost', handleHost);
        // _viewResizerWrapper is defined by this.attach. It is the editing view element of the div of class ck-widget__resizer
        const resizerWrapper = this._viewResizerWrapper;
        // console.log('resizerWrapper', resizerWrapper);
        const currentDimensions = [
            /*
            resizerWrapper.getStyle('width'),
            resizerWrapper.getStyle('height'),
            resizerWrapper.getStyle('left'),
            resizerWrapper.getStyle('top')
            */

            resizerWrapper.getStyle('width'),
            resizerWrapper.getStyle('height')
        ];
        // console.log('currentDimensions', currentDimensions);


        let newDimensions;
        /* In our case widgetWrapper === handleHost. Thus handleHost is not needed
        // if (widgetWrapper.isSameNode(handleHost)) {
        if (widgetWrapper === handleHost) {
            const clientRect = handleHostRect || new Rect(handleHost);
            newDimensions = [
                clientRect.width + 'px',
                clientRect.height + 'px',
                undefined,
                undefined
            ];
        }
        // In case a resizing host is not a widget wrapper, we need to compensate
        // for any additional offsets the resize host might have. E.g. wrapper padding
        // or simply another editable. By doing that the border and resizers are shown
        // only around the resize host.
        else {
            newDimensions = [
                handleHost.offsetWidth + 'px',
                handleHost.offsetHeight + 'px',
                handleHost.offsetLeft + 'px',
                handleHost.offsetTop + 'px'
            ];
        } 
        */

        // Replacement
        const clientRect = handleHostRect || new Rect(widgetWrapper);
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
                }, resizerWrapper);
            });
            console.log( 'IsResizer#redraw changed dimensions in resizer' );
        }

        // console.log('IsResizer#redraw end');
    }

    containsHandle(domElement) {
        return this._domResizerWrapper.contains(domElement);
    }

    static isResizeHandle(domElement) {
        // return domElement.classList.contains('is-widget__resizer__handle');
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
    _getResizeHost() {
        const widgetWrapper = this._domResizerWrapper.parentElement;
        return this._options.getResizeHost(widgetWrapper);
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
    _getHandleHost() {
        const widgetWrapper = this._domResizerWrapper.parentElement;
        return this._options.getHandleHost(widgetWrapper);
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
            domElement.appendChild((new Template({
                tag: 'div',
                attributes: {
                    class: `ck-widget__resizer__handle ${getResizerClass(currentPosition)}`
                }
            }).render()));

            /* This was a debugging alternative
            const template = new Template({
                tag: 'div',
                attributes: {
                    // class: `is-widget__resizer__handle ${getResizerClass(currentPosition)}`
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
            writer.setStyle('width', this._initialViewWidth, this._options.viewElement);
        });
        console.log('setStyle of this._options.viewElement to width=', this._initialViewWidth);
    }

    /**
     * Calculates the proposed size as the resize handles are dragged.
     *
     * @private
     * @param {Event} domEventData Event data that caused the size update request. It should be used to calculate the proposed size.
     * @returns {Object} return
     * @returns {Number} return.width Proposed width.
     * @returns {Number} return.height Proposed height.
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
        // const resizeHost = this._getResizeHost();
        // The size proposed by the user. It does not consider the aspect ratio.
        let width = Math.abs(state.originalWidth + enlargement.x);
        let height = Math.abs(state.originalHeight + enlargement.y);
        // Dominant determination must take the ratio into account.
        /*
        const dominant = width / state.aspectRatio > height ? 'width' : 'height';
        if (dominant == 'width') {
            height = width / state.aspectRatio;
        }
        else {
            width = height * state.aspectRatio;
        }
        */
        return {
            width: Math.round(width) + 'px',
            height: Math.round(height) + 'px'
            // widthPercents: Math.min(Math.round(state.originalWidthPercents / state.originalWidth * width * 100) / 100, 100)
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