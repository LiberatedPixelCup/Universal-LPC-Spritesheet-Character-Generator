// Scrollable container with drag-to-scroll support
export const ScrollableContainer = {
	oninit: function(vnode) {
		vnode.state.isDragging = false;
		vnode.state.startX = 0;
		vnode.state.startY = 0;
		vnode.state.scrollLeft = 0;
		vnode.state.scrollTop = 0;
	},
	oncreate: function(vnode) {
		const container = vnode.dom;

		// Mouse down - start dragging
		container.addEventListener('mousedown', (e) => {
			vnode.state.isDragging = true;
			vnode.state.startX = e.pageX - container.offsetLeft;
			vnode.state.startY = e.pageY - container.offsetTop;
			vnode.state.scrollLeft = container.scrollLeft;
			vnode.state.scrollTop = container.scrollTop;
			container.style.cursor = 'grabbing';
		});

		// Mouse leave/up - stop dragging
		const stopDragging = () => {
			vnode.state.isDragging = false;
			container.style.cursor = 'grab';
		};

		container.addEventListener('mouseleave', stopDragging);
		container.addEventListener('mouseup', stopDragging);

		// Mouse move - drag scroll
		container.addEventListener('mousemove', (e) => {
			if (!vnode.state.isDragging) return;
			e.preventDefault();
			const x = e.pageX - container.offsetLeft;
			const y = e.pageY - container.offsetTop;
			const walkX = (x - vnode.state.startX) * 1.5; // Scroll speed multiplier
			const walkY = (y - vnode.state.startY) * 1.5;
			container.scrollLeft = vnode.state.scrollLeft - walkX;
			container.scrollTop = vnode.state.scrollTop - walkY;
		});
	},
	view: function(vnode) {
		return m("div.scrollable-container.mt-3", vnode.children);
	}
};
