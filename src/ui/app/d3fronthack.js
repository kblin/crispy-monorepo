d3.selection.prototype.toFront = function toFront() {
    return this.each(function reappend(){
        this.parentNode.appendChild(this);
    });
};
