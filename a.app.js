function _make_global_func(obj, code)
{
	var keys = Array.concat(Object.keys(obj), code);
	return Function.apply(obj, keys);
}

class NodeSub
{
	constructor(node)
	{
		this.node = node;

		this.func = false;
		this.textLeft = "";
	}

	build_text(obj)
	{
		var ret = this.textLeft;
		if (this.func !== false) {
			ret += this.func.apply(obj, Object.values(obj));
		}
		return ret;
	}
}

class AppNode
{
	constructor(app, node)
	{
		this.app = app;
		this.node = node;

		this.subs_attrs = {};
	}

	render()
	{
	}
}

class TextAppNode extends AppNode
{
	constructor(app, node)
	{
		super(app, node);

		this.subs_text = [];

		var text = node.textContent;
		var indexLeft = -1;

		while (true) {
			indexLeft = text.indexOf("{{");
			if (indexLeft == -1) {
				if (this.subs_text.length > 0) {
					var nodesub = new NodeSub(this);
					nodesub.textLeft = text;
					this.subs_text.push(nodesub);
				}
				break;
			}

			var textLeft = text.substr(0, indexLeft);
			text = text.substr(indexLeft + 2);

			var indexRight = text.indexOf("}}");
			if (indexRight == -1) {
				console.error("Couldn't find ending '}}'!");
				break;
			}

			var code = text.substr(0, indexRight);

			var nodesub = new NodeSub(this);
			nodesub.func = _make_global_func(this.app.data, "return " + code);
			nodesub.textLeft = textLeft;
			this.subs_text.push(nodesub);

			text = text.substr(indexRight + 2);
		}
	}

	render()
	{
		if (this.subs_text.length == 0) {
			return;
		}

		var text = "";
		for (var i = 0; i < this.subs_text.length; i++) {
			text += this.subs_text[i].build_text(this.app.data);
		}
		this.node.textContent = text;
	}
}

class App
{
	constructor(data)
	{
		if (data === undefined) {
			data = {};
		}
		this.data = this._make_proxy(data, "");
		this._initialize_node(document.body);
		this.init_render_node = false;
	}

	_initialize_node(node)
	{
		if (node.nodeType == Node.TEXT_NODE) {
			node._app = new TextAppNode(this, node);
		}

		if (node._app !== undefined) {
			this.init_render_node = node._app;
			node._app.render();
		}

		for (var i = 0; i < node.childNodes.length; i++) {
			this._initialize_node(node.childNodes[i]);
		}
	}

	_make_proxy(data, path)
	{
		for (let i in data) {
			if (typeof(data[i]) == "object") {
				data[i] = this._make_proxy(data[i], path + i + ".");
			}
		}

		return new Proxy(data, {
			_app: this,
			_path: path,
			_nodes: [],

			get: function(target, property, receiver) {
				var renderNode = this._app.init_render_node;
				if (renderNode && this._nodes.indexOf(renderNode) == -1) {
					this._nodes.push(renderNode);
				}
				return target[property];
			},

			set: function(target, property, value, receiver) {
				let oldvalue = target[property];
				if (oldvalue == value) {
					return true;
				}

				if (typeof(value) == "object") {
					target[property] = this._app._make_proxy(value, this._path + property + ".");
				} else {
					target[property] = value;
				}
				//TODO: path here might not be necessary if we cache DOM
				this._app._data_changed(this, receiver, this._path + property, value, oldvalue);

				return true;
			}
		});
	}

	_data_changed(proxy, object, property, newvalue, oldvalue)
	{
		if (oldvalue === undefined) {
			//TODO: this is a problem..
			console.log("New: \"" + property + "\"");

		} else {
			for (var i = 0; i < proxy._nodes.length; i++) {
				proxy._nodes[i].render();
			}
		}
	}
}
