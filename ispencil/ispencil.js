// ispencil/ispencil.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import IsPencilEditing from './ispencilediting';

export default class IsPencil extends Plugin {

	static get pluginName() {
		return 'IsPencil';
	}

    static get requires() {
        return [ IsPencilEditing ];
    }
}