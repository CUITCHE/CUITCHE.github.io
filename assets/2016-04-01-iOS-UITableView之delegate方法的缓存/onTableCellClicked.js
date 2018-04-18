require('UIAlertView,NSString');
defineClass('ViewController', {
    tableView_didSelectRowAtIndexPath: function(tableView, indexPath) {
        tableView.deselectRowAtIndexPath_animated(indexPath, YES);
        var alert = UIAlertView.alloc().initWithTitle_message_delegate_cancelButtonTitle_otherButtonTitles("来自JSPatch的信息", NSString.stringWithFormat("%lu行被点击", indexPath.row()), null, "好吧", null);
        alert.show();
    },
    onButtonClicked: function(sender) {
        var alert = UIAlertView.alloc().initWithTitle_message_delegate_cancelButtonTitle_otherButtonTitles("来自JSPatch的信息", "方法覆盖成功", null, "好吧", null);
        alert.show();
    }
}
);
