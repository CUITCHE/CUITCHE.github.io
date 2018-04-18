---
layout: post
title: iOS-UITableView之delegate方法的缓存
excerpt: "本文一步一步探索了UITableViewDelegate协议方法的缓存机制。运用Objective-C的runtime探究UITableView的delegate的秘密。"
categories: [iOS]
comments: true
image:
  feature: iOS-UITableView之delegate方法的缓存.feature.jpeg
  credit: ppppic.com
  creditlink: http://ppppic.com/image?src=10/7/27303_303306.jpg
---

最近在写JSPatch，想做一个简单的Demo，利用JSPatch动态修改方法的能力，写了一个简单的Demo。
代码如下：

{% highlight objectivec %}
// ViewController.h
#import <UIKit/UIKit.h>

@interface ViewController : UIViewController

@end
{% endhighlight objectivec %}

头文件很简单。我们还是看.m文件吧

{% highlight objectivec %}
// ViewController.m
@interface ViewController ()<UITableViewDataSource, UITableViewDelegate>

@property (nonatomic, strong) UITableView *tableView;
@property (nonatomic, strong) NSArray<NSString *> *dataSource;

@property (nonatomic, strong) NSTimer *timer;
@property (nonatomic, strong) UIButton *button;

@end

@implementation ViewController


- (void)loadView
{
    [super loadView];
    self.automaticallyAdjustsScrollViewInsets = NO;
    _timer = [NSTimer scheduledTimerWithTimeInterval:0.5
                                              target:self
                                            selector:@selector(onTimer:)
                                            userInfo:nil
                                             repeats:YES];
    [_timer fire];

    _dataSource = @[@"1", @"2", @"3", @"4", @"5", @"6", @"7", @"8", @"9", @"10",
                    @"11", @"12", @"13", @"14", @"15", @"16",];
    _tableView = [[UITableView alloc] initWithFrame:CGRectMake(0, 20, CGRectGetWidth([UIScreen mainScreen].bounds), 400)
                                              style:UITableViewStylePlain];
    _tableView.delegate = self;
    _tableView.dataSource = self;
    [self.view addSubview:_tableView];

    _button = [[UIButton alloc] initWithFrame:CGRectMake(0, 20+400, 200, 80)];
    _button.backgroundColor = [UIColor blackColor];
    [_button addTarget:self
                action:@selector(onButtonClicked:)
      forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:_button];
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section
{
    return _dataSource.count;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath
{
    NSString *const identifier = @"identifier";
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:identifier];
    if (!cell) {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:identifier];
    }
    cell.textLabel.text = _dataSource[indexPath.row];
    return cell;
}

- (CGFloat)tableView:(UITableView *)tableView heightForRowAtIndexPath:(NSIndexPath *)indexPath
{
    return 32;
}

//- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath
//{
//    [tableView deselectRowAtIndexPath:indexPath animated:YES];
//    UIAlertView *alert = [[UIAlertView alloc] initWithTitle:@"来自JSPatch的信息"
//                                                    message:[NSString stringWithFormat:@"%ld行被点击", (long)indexPath.row]
//                                                   delegate:nil
//                                          cancelButtonTitle:@"好吧"
//                                          otherButtonTitles:nil];
//    [alert show];
//}

- (void)onTimer:(id)sender
{
    NSLog(@"%@", [self respondsToSelector:@selector(onButtonClicked:)] ? @"方法存在" : @"方法不存在");
}

//- (void)onButtonClicked_fake
//{
//    NSLog(@"fake clicked! Will do nothing!");
//}
//
//- (NSMethodSignature *)methodSignatureForSelector:(SEL)aSelector
//{
//    NSMethodSignature *sig = [super methodSignatureForSelector:aSelector];
//    if (!sig) {
//        if ([NSStringFromSelector(aSelector) isEqualToString:NSStringFromSelector(@selector(onButtonClicked:))]) {
//            sig = [self methodSignatureForSelector:@selector(onButtonClicked_fake)];
//        }
//    }
//
//    return sig;
//}
//
//- (void)forwardInvocation:(NSInvocation *)anInvocation
//{
////    NSLog(@"%@", anInvocation);
////    if ([NSStringFromSelector(anInvocation.selector) isEqualToString:NSStringFromSelector(@selector(onButtonClicked:))]) {
////        anInvocation.selector = @selector(onButtonClicked_fake:);
////        [anInvocation invoke];
////    }
//}

- (BOOL)respondsToSelector:(SEL)aSelector
{
    NSLog(@"%@", NSStringFromSelector(aSelector));
    return [super respondsToSelector:aSelector];
}
@end
{% endhighlight objectivec %}

我的想法是在运行的时候，通过JSPatch生成`- (void)tableView: didSelectRowAtIndexPath:`方法，在点击UITableViewCell的时候，能响应，弹出对话框。然而在生成了tableview后，再执行JSPatch把`- (void)tableView: didSelectRowAtIndexPath:`添加进去，点击cell的时候居然不响应。
为此，我写了一个button来测试。从上面的代码可以看出，我用button关联一个不存在的方法selector(onButtonClicked:)——这个方法我在JSPatch里实现，在运行的时候动态加载。最后，我点击button后成功响应了。我就在想是不是UITableView本身的问题。

> - 请注意，先生成了Table和Button并成功显示在界面上后延迟10秒加载JSPatch。
> - JS文件，请参考：[onTableCellClicked](/assets/2016-04-01-iOS-UITableView之delegate方法的缓存/onTableCellClicked.js)

一般地，我们在使用delegate调用方法的时候，为了不引起程序crash，都会小心的加上一句：`[obj respondsToSelector:aSelector]`，去询问『我可以调这个方法』，如果不行就不调用了，免得crash。
当然，UITableView肯定也会调用`[obj respondsToSelector:aSelector]`的，所以我重写ViewController的`respondsToSelector:`方法。

{% highlight objectivec %}
- (BOOL)respondsToSelector:(SEL)aSelector
{
    NSLog(@"%@", NSStringFromSelector(aSelector));
    return [super respondsToSelector:aSelector];
}
{% endhighlight objectivec %}

为了不产生副作用，我直接在重写的方法中调用了父类的方法，并打印selecotr字符串。运行程序，程序输出了：

```
2016-04-01 14:57:32.157 OCRumtiimInvoke[4675:237601] isInWillRotateCallback
2016-04-01 14:57:32.160 OCRumtiimInvoke[4675:237601] rotatingContentViewForWindow:
2016-04-01 14:57:32.187 OCRumtiimInvoke[4675:237601] _isViewControllerInWindowHierarchy
2016-04-01 14:57:32.189 OCRumtiimInvoke[4675:237601] scrollViewDidScroll:
2016-04-01 14:57:32.189 OCRumtiimInvoke[4675:237601] scrollViewDidZoom:
2016-04-01 14:57:32.189 OCRumtiimInvoke[4675:237601] scrollView:contentSizeForZoomScale:withProposedSize:
2016-04-01 14:57:32.189 OCRumtiimInvoke[4675:237601] scrollViewDidChangeContentSize:
2016-04-01 14:57:32.189 OCRumtiimInvoke[4675:237601] _scrollView:adjustedOffsetForOffset:translation:startPoint:locationInView:horizontalVelocity:verticalVelocity:
2016-04-01 14:57:32.190 OCRumtiimInvoke[4675:237601] tableView:cellForRowAtIndexPath:
2016-04-01 14:57:32.190 OCRumtiimInvoke[4675:237601] tableView:willDisplayCell:forRowAtIndexPath:
2016-04-01 14:57:32.190 OCRumtiimInvoke[4675:237601] tableView:didEndDisplayingCell:forRowAtIndexPath:
2016-04-01 14:57:32.190 OCRumtiimInvoke[4675:237601] tableView:didEndDisplayingHeaderView:forSection:
2016-04-01 14:57:32.190 OCRumtiimInvoke[4675:237601] tableView:didEndDisplayingFooterView:forSection:
2016-04-01 14:57:32.190 OCRumtiimInvoke[4675:237601] tableView:heightForRowAtIndexPath:
2016-04-01 14:57:32.190 OCRumtiimInvoke[4675:237601] tableView:heightForHeaderInSection:
2016-04-01 14:57:32.190 OCRumtiimInvoke[4675:237601] tableView:maxTitleWidthForHeaderInSection:
2016-04-01 14:57:32.190 OCRumtiimInvoke[4675:237601] tableView:heightForFooterInSection:
2016-04-01 14:57:32.190 OCRumtiimInvoke[4675:237601] tableView:maxTitleWidthForFooterInSection:
2016-04-01 14:57:32.191 OCRumtiimInvoke[4675:237601] tableView:estimatedHeightForRowAtIndexPath:
2016-04-01 14:57:32.191 OCRumtiimInvoke[4675:237601] tableView:estimatedHeightForHeaderInSection:
2016-04-01 14:57:32.191 OCRumtiimInvoke[4675:237601] tableView:estimatedHeightForFooterInSection:
2016-04-01 14:57:32.191 OCRumtiimInvoke[4675:237601] tableView:viewForHeaderInSection:
2016-04-01 14:57:32.191 OCRumtiimInvoke[4675:237601] tableView:viewForFooterInSection:
2016-04-01 14:57:32.191 OCRumtiimInvoke[4675:237601] tableView:displayedItemCountForRowCount:
2016-04-01 14:57:32.191 OCRumtiimInvoke[4675:237601] tableView:displayStringForRowCount:
2016-04-01 14:57:32.191 OCRumtiimInvoke[4675:237601] tableView:accessoryTypeForRowWithIndexPath:
2016-04-01 14:57:32.192 OCRumtiimInvoke[4675:237601] tableView:accessoryButtonTappedForRowWithIndexPath:
2016-04-01 14:57:32.192 OCRumtiimInvoke[4675:237601] tableView:willSelectRowAtIndexPath:
2016-04-01 14:57:32.192 OCRumtiimInvoke[4675:237601] tableView:willDeselectRowAtIndexPath:
2016-04-01 14:57:32.192 OCRumtiimInvoke[4675:237601] tableView:didSelectRowAtIndexPath:
2016-04-01 14:57:32.192 OCRumtiimInvoke[4675:237601] tableView:didDeselectRowAtIndexPath:
2016-04-01 14:57:32.192 OCRumtiimInvoke[4675:237601] tableView:willBeginEditingRowAtIndexPath:
2016-04-01 14:57:32.192 OCRumtiimInvoke[4675:237601] tableView:didEndEditingRowAtIndexPath:
2016-04-01 14:57:32.192 OCRumtiimInvoke[4675:237601] tableView:targetIndexPathForMoveFromRowAtIndexPath:toProposedIndexPath:
2016-04-01 14:57:32.193 OCRumtiimInvoke[4675:237601] tableView:editingStyleForRowAtIndexPath:
2016-04-01 14:57:32.193 OCRumtiimInvoke[4675:237601] tableView:titleForDeleteConfirmationButtonForRowAtIndexPath:
2016-04-01 14:57:32.193 OCRumtiimInvoke[4675:237601] tableView:editActionsForRowAtIndexPath:
2016-04-01 14:57:32.193 OCRumtiimInvoke[4675:237601] tableView:shouldIndentWhileEditingRowAtIndexPath:
2016-04-01 14:57:32.193 OCRumtiimInvoke[4675:237601] tableView:indentationLevelForRowAtIndexPath:
2016-04-01 14:57:32.193 OCRumtiimInvoke[4675:237601] tableView:wantsHeaderForSection:
2016-04-01 14:57:32.193 OCRumtiimInvoke[4675:237601] tableView:heightForRowsInSection:
2016-04-01 14:57:32.193 OCRumtiimInvoke[4675:237601] marginForTableView:
2016-04-01 14:57:32.194 OCRumtiimInvoke[4675:237601] tableView:titleAlignmentForHeaderInSection:
2016-04-01 14:57:32.194 OCRumtiimInvoke[4675:237601] tableView:titleAlignmentForFooterInSection:
2016-04-01 14:57:32.194 OCRumtiimInvoke[4675:237601] tableView:frameForSectionIndexGivenProposedFrame:
2016-04-01 14:57:32.194 OCRumtiimInvoke[4675:237601] tableViewDidFinishReload:
2016-04-01 14:57:32.194 OCRumtiimInvoke[4675:237601] heightForHeaderInTableView:
2016-04-01 14:57:32.194 OCRumtiimInvoke[4675:237601] heightForFooterInTableView:
2016-04-01 14:57:32.194 OCRumtiimInvoke[4675:237601] viewForHeaderInTableView:
2016-04-01 14:57:32.194 OCRumtiimInvoke[4675:237601] viewForFooterInTableView:
2016-04-01 14:57:32.194 OCRumtiimInvoke[4675:237601] tableView:calloutTargetRectForCell:forRowAtIndexPath:
2016-04-01 14:57:32.195 OCRumtiimInvoke[4675:237601] tableView:shouldShowMenuForRowAtIndexPath:
2016-04-01 14:57:32.195 OCRumtiimInvoke[4675:237601] tableView:canPerformAction:forRowAtIndexPath:withSender:
2016-04-01 14:57:32.195 OCRumtiimInvoke[4675:237601] tableView:performAction:forRowAtIndexPath:withSender:
2016-04-01 14:57:32.195 OCRumtiimInvoke[4675:237601] tableView:willBeginReorderingRowAtIndexPath:
2016-04-01 14:57:32.195 OCRumtiimInvoke[4675:237601] tableView:didEndReorderingRowAtIndexPath:
2016-04-01 14:57:32.195 OCRumtiimInvoke[4675:237601] tableView:didCancelReorderingRowAtIndexPath:
2016-04-01 14:57:32.195 OCRumtiimInvoke[4675:237601] tableView:willDisplayHeaderView:forSection:
2016-04-01 14:57:32.196 OCRumtiimInvoke[4675:237601] tableView:willDisplayFooterView:forSection:
2016-04-01 14:57:32.196 OCRumtiimInvoke[4675:237601] tableView:shouldHighlightRowAtIndexPath:
2016-04-01 14:57:32.196 OCRumtiimInvoke[4675:237601] tableView:didHighlightRowAtIndexPath:
2016-04-01 14:57:32.196 OCRumtiimInvoke[4675:237601] tableView:didUnhighlightRowAtIndexPath:
2016-04-01 14:57:32.196 OCRumtiimInvoke[4675:237601] tableView:titleForSwipeAccessoryButtonForRowAtIndexPath:
2016-04-01 14:57:32.196 OCRumtiimInvoke[4675:237601] tableView:backgroundColorForDeleteConfirmationButtonForRowAtIndexPath:
2016-04-01 14:57:32.196 OCRumtiimInvoke[4675:237601] tableView:backgroundColorForSwipeAccessoryButtonForRowAtIndexPath:
2016-04-01 14:57:32.196 OCRumtiimInvoke[4675:237601] tableView:deleteConfirmationButtonForRowAtIndexPath:
2016-04-01 14:57:32.197 OCRumtiimInvoke[4675:237601] tableView:swipeAccessoryButtonForRowAtIndexPath:
2016-04-01 14:57:32.197 OCRumtiimInvoke[4675:237601] tableView:swipeAccessoryButtonPushedForRowAtIndexPath:
2016-04-01 14:57:32.197 OCRumtiimInvoke[4675:237601] tableView:shouldDrawTopSeparatorForSection:
2016-04-01 14:57:32.197 OCRumtiimInvoke[4675:237601] tableView:willBeginSwipingRowAtIndexPath:
2016-04-01 14:57:32.197 OCRumtiimInvoke[4675:237601] tableView:didEndSwipingRowAtIndexPath:
2016-04-01 14:57:32.197 OCRumtiimInvoke[4675:237601] _tableView:canFocusRowAtIndexPath:
2016-04-01 14:57:32.197 OCRumtiimInvoke[4675:237601] tableView:canFocusRowAtIndexPath:
2016-04-01 14:57:32.197 OCRumtiimInvoke[4675:237601] tableView:didFocusRowAtIndexPath:
2016-04-01 14:57:32.197 OCRumtiimInvoke[4675:237601] tableView:didUnfocusRowAtIndexPath:
2016-04-01 14:57:32.198 OCRumtiimInvoke[4675:237601] tableView:shouldChangeFocusedItem:fromRowAtIndexPath:
2016-04-01 14:57:32.198 OCRumtiimInvoke[4675:237601] indexPathForPreferredFocusedItemForTableView:
2016-04-01 14:57:32.198 OCRumtiimInvoke[4675:237601] tableView:shouldUpdateFocusFromRowAtIndexPath:toView:heading:
2016-04-01 14:57:32.198 OCRumtiimInvoke[4675:237601] indexPathForPreferredFocusedViewInTableView:
2016-04-01 14:57:32.198 OCRumtiimInvoke[4675:237601] tableView:shouldUpdateFocusInContext:
2016-04-01 14:57:32.198 OCRumtiimInvoke[4675:237601] tableView:didUpdateFocusInContext:withAnimationCoordinator:
2016-04-01 14:57:32.198 OCRumtiimInvoke[4675:237601] _tableView:templateLayoutCellForCellsWithReuseIdentifier:
2016-04-01 14:57:32.198 OCRumtiimInvoke[4675:237601] _tableView:willLayoutCell:usingTemplateLayoutCell:forRowAtIndexPath:
2016-04-01 14:57:32.198 OCRumtiimInvoke[4675:237601] tableView:numberOfRowsInSection:
2016-04-01 14:57:32.199 OCRumtiimInvoke[4675:237601] tableView:cellForRowAtIndexPath:
2016-04-01 14:57:32.199 OCRumtiimInvoke[4675:237601] numberOfSectionsInTableView:
2016-04-01 14:57:32.199 OCRumtiimInvoke[4675:237601] tableView:titleForHeaderInSection:
2016-04-01 14:57:32.199 OCRumtiimInvoke[4675:237601] tableView:titleForFooterInSection:
2016-04-01 14:57:32.199 OCRumtiimInvoke[4675:237601] tableView:commitEditingStyle:forRowAtIndexPath:
2016-04-01 14:57:32.199 OCRumtiimInvoke[4675:237601] sectionIndexTitlesForTableView:
2016-04-01 14:57:32.199 OCRumtiimInvoke[4675:237601] tableView:sectionForSectionIndexTitle:atIndex:
2016-04-01 14:57:32.199 OCRumtiimInvoke[4675:237601] tableView:moveRowAtIndexPath:toIndexPath:
2016-04-01 14:57:32.200 OCRumtiimInvoke[4675:237601] tableView:canEditRowAtIndexPath:
2016-04-01 14:57:32.200 OCRumtiimInvoke[4675:237601] tableView:canMoveRowAtIndexPath:
2016-04-01 14:57:32.200 OCRumtiimInvoke[4675:237601] tableView:didUpdateTextFieldForRowAtIndexPath:withValue:
2016-04-01 14:57:32.200 OCRumtiimInvoke[4675:237601] tableView:shouldShowMenuForRowAtIndexPath:
2016-04-01 14:57:32.200 OCRumtiimInvoke[4675:237601] tableView:canPerformAction:forRowAtIndexPath:withSender:
2016-04-01 14:57:32.200 OCRumtiimInvoke[4675:237601] tableView:performAction:forRowAtIndexPath:withSender:
2016-04-01 14:57:32.200 OCRumtiimInvoke[4675:237601] tableView:indexPathForSectionIndexTitle:atIndex:
2016-04-01 14:57:32.200 OCRumtiimInvoke[4675:237601] tableView:indexPathForSectionIndexTitle:atIndex:
2016-04-01 14:57:32.200 OCRumtiimInvoke[4675:237601] tableView:detailTextForHeaderInSection:
2016-04-01 14:57:32.201 OCRumtiimInvoke[4675:237601] _appearanceContainer
```

看到输出结果，此时我的内心是激动的。输出了所有`UITableViewDataSource, UITableViewDelegate`协议的方法名字，这就意味着，程序在某个地方对这两个协议的方法都询问了一遍。然后我又猜测，唯一的合理的地方应该是我们在设置UITableView的delegate和dataSource的时候执行询问操作的。因为只有设置了delegate了，对这些方法的询问才有意义。于是我在代码中注释了这两句
{% highlight objectivec %}
//    _tableView.delegate = self;
//    _tableView.dataSource = self;
{% endhighlight objectivec %}

再执行程序，输出：
```
2016-04-01 15:01:16.516 OCRumtiimInvoke[4755:241107] isInWillRotateCallback
2016-04-01 15:01:16.516 OCRumtiimInvoke[4755:241107] rotatingContentViewForWindow:
2016-04-01 15:01:16.546 OCRumtiimInvoke[4755:241107] _isViewControllerInWindowHierarchy
2016-04-01 15:01:16.550 OCRumtiimInvoke[4755:241107] _appearanceContainer
```

简直喜出望外！

然后，问题来了：『那么，UITableView是怎么保存询问的结果的呢』。
很多人就会想到用一个BOOL数组，可是这样太过于浪费了，在Objective-C中BOOL相当于一个int的大小。询问的结果只有两种：有(1)和没有(0)。所以，这个时候，我们就需要用到在C/C++中常用到的位域结构体了。

> 关于位域的知识，请看[百科](http://baike.baidu.com/link?url=cWt3g5NhSJkqYXy5RPsEcgI2xiKd0K-G7zP8srRu4icleeDw5ow82Ljv13QHa_VBvw_xAr3AKm5NNzK9-wpVDq)，本文不做过多解释。

Apple在设计UITableView的时候，肯定也想到了。所以，我们就大胆猜测，在UITableView中有这样一个结构体保存但不局限于`UITableViewDataSource, UITableViewDelegate`协议中的方法。

但，我们怎么获取到这个变量呢。

Objective-C作为一门动态语言，获取一个变量（私有）还是很容易的。随便到网上搜一篇就有详细的讲解，我这里直接贴代码了：

{% highlight objectivec %}
- (void)onButtonClicked:(id)sender
{
    Class curClass = NSClassFromString(@"UITableView");
    unsigned int numIvars; //成员变量个数
    Ivar *vars = class_copyIvarList(curClass, &numIvars);

    NSString *name = nil;
    NSString *type = nil;
    for(int i = 0; i < numIvars; i++) {
        Ivar thisIvar = vars[i];
        //获取成员变量的名字
        name = [NSString stringWithUTF8String:ivar_getName(thisIvar)];
        //获取成员变量的数据类型
        type = [NSString stringWithUTF8String:ivar_getTypeEncoding(thisIvar)];
        @try {
            NSLog(@"%@(%@):%@", name, type, [_tableView valueForKey:name]);
        } @catch (NSException *exception) {
            NSLog(@"%@", exception);
        } @finally {
            ;
        }
    }
    free(vars);
}
{% endhighlight objectivec %}

由于输出太多了，我就只截取重要部分：
```
2016-04-01 15:25:01.253 OCRumtiimInvoke[5077:257772] _targetIndexPathForScrolling(@"NSIndexPath"):(null)
2016-04-01 15:25:01.254 OCRumtiimInvoke[5077:257772] _targetOffsetToIndexPathForScrolling({CGPoint="x"d"y"d}):NSPoint: {0, 0}
2016-04-01 15:25:01.254 OCRumtiimInvoke[5077:257772] _tableFlags({?="dataSourceNumberOfRowsInSection"b1"dataSourceCellForRow"b1"dataSourceNumberOfSectionsInTableView"b1"dataSourceTitleForHeaderInSection"b1"dataSourceTitleForFooterInSection"b1"dataSourceDetailTextForHeaderInSection"b1"dataSourceCommitEditingStyle"b1"dataSourceSectionIndexTitlesForTableView"b1"dataSourceSectionForSectionIndexTitle"b1"dataSourceCanEditRow"b1"dataSourceCanMoveRow"b1"dataSourceCanUpdateRow"b1"dataSourceShouldShowMenu"b1"dataSourceCanPerformAction"b1"dataSourcePerformAction"b1"dataSourceIndexPathForSectionIndexTitle"b1"dataSourceWasNonNil"b1"delegateEditingStyleForRowAtIndexPath"b1"delegateTitleForDeleteConfirmationButtonForRowAtIndexPath"b1"delegateEditActionsForRowAtIndexPath"b1"delegateShouldIndentWhileEditing"b1"dataSourceMoveRow"b1"delegateCellForRow"b1"delegateWillDisplayCell"b1"delegateDidEndDisplayingCell"b1"delegateDidEndDisplayingSectionHeader"b1"delegateDidEndDisplayingSectionFooter"b1"delegateHeightForRow"b1"delegateHeightForSectionHeader"b1"delegateTitleWidthForSectionHeader"b1"delegateHeightForSectionFooter"b1"delegateTitleWidthForSectionFooter"b1"delegateEstimatedHeightForRow"b1"delegateEstimatedHeightForSectionHeader"b1"delegateEstimatedHeightForSectionFooter"b1"delegateViewForHeaderInSection"b1"delegateViewForFooterInSection"b1"delegateDisplayedItemCountForRowCount"b1"delegateDisplayStringForRowCount"b1"delegateAccessoryTypeForRow"b1"delegateAccessoryButtonTappedForRow"b1"delegateWillSelectRow"b1"delegateWillDeselectRow"b1"delegateDidSelectRow"b1"delegateDidDeselectRow"b1"delegateWillBeginEditing"b1"delegateDidEndEditing"b1"delegateWillMoveToRow"b1"delegateIndentationLevelForRow"b1"delegateWantsHeaderForSection"b1"delegateHeightForRowsInSection"b1"delegateMargin"b1"delegateHeaderTitleAlignment"b1"delegateFooterTitleAlignment"b1"delegateFrameForSectionIndexGivenProposedFrame"b1"delegateDidFinishReload"b1"delegateHeightForHeader"b1"delegateHeightForFooter"b1"delegateViewForHeader"b1"delegateViewForFooter"b1"delegateCalloutTargetRectForCell"b1"delegateShouldShowMenu"b1"delegateCanPerformAction"b1"delegatePerformAction"b1"delegateWillBeginReordering"b1"delegateDidEndReordering"b1"delegateDidCancelReordering"b1"delegateWillDisplayHeaderViewForSection"b1"delegateWillDisplayFooterViewForSection"b1"delegateShouldHighlightRow"b1"delegateDidHighlightRow"b1"delegateDidUnhighlightRow"b1"delegateTitleForSwipeAccessory"b1"delegateBackgroundColorForDeleteConfirmationButton"b1"delegateBackgroundColorForSwipeAccessory"b1"delegateDeleteConfirmationButton"b1"delegateSwipeAccessory"b1"delegateSwipeAccessoryPushed"b1"delegateShouldDrawTopSeparatorForSection"b1"delegateWillBeginSwiping"b1"delegateDidEndSwiping"b1"delegateCanFocusRow_deprecated"b1"delegateCanFocusRow"b1"delegateDidFocusRow"b1"delegateDidUnfocusRow"b1"delegateShouldChangeFocusedItem"b1"delegateIndexPathForPreferredFocusedItem"b1"delegateShouldUpdateFocusFromRowAtIndexPathToView"b1"delegateIndexPathForPreferredFocusedView"b1"delegateShouldUpdateFocusInContext"b1"delegateDidUpdateFocusInContext"b1"delegateTemplateLayoutCell"b1"delegateWillLayoutCellUsingTemplateLayoutCell"b1"delegateWasNonNil"b1"style"b1"separatorStyle"b3"wasEditing"b1"isEditing"b1"isEditingAllRows"b1"scrollsToSelection"b1"reloadSkippedDuringSuspension"b1"updating"b1"displaySkippedDuringSuspension"b1"needsReload"b1"updatingVisibleCellsManually"b1"scheduledUpdateVisibleCells"b1"scheduledUpdateVisibleCellsFrames"b1"warnForForcedCellUpdateDisabled"b1"displayTopSeparator"b1"countStringInsignificantRowCount"b4"needToAdjustExtraSeparators"b1"overlapsSectionHeaderViews"b1"ignoreTouchSelect"b1"lastHighlightedRowActive"b1"reloading"b1"allowsSelection"b1"allowsSelectionDuringEditing"b1"allowsMultipleSelection"b1"allowsMultipleSelectionDuringEditing"b1"showsSelectionImmediatelyOnTouchBegin"b1"indexHidden"b1"indexHiddenForSearch"b1"defaultShowsHorizontalScrollIndicator"b1"defaultShowsVerticalScrollIndicator"b1"sectionIndexTitlesLoaded"b1"tableHeaderViewShouldAutoHide"b1"tableHeaderViewIsHidden"b1"tableHeaderViewWasHidden"b1"tableHeaderViewShouldPin"b1"hideScrollIndicators"b1"sendReloadFinished"b1"keepFirstResponderWhenInteractionDisabled"b1"keepFirstResponderVisibleOnBoundsChange"b1"dontDrawTopShadowInGroupedSections"b1"forceStaticHeadersAndFooters"b1"displaysCellContentStringsOnTapAndHold"b1"displayingCellContentStringCallout"b1"longPressAutoscrollingActive"b1"adjustsRowHeightsForSectionLocation"b1"inInit"b1"inSetBackgroundColor"b1"inCreateTemplateCell"b1"usingCustomBackgroundView"b1"rowDataIndexPathsAreValidForCurrentCells"b1"committingDelete"b1"didReloadWhileCommittingDelete"b1"editingForSwipeDelete"b1"wasEditingForSwipeToDeleteBeforeSuspendedReload"b1"ignorePinnedTableHeaderUpdates"b1"navigationGestureWasEnabledBeforeSwipeToDelete"b1"didDisableNavigationGesture"b1"separatorsDrawAsOverlay"b1"swipeToDeleteRowIsBeingDeleted"b1"drawsSeparatorAtTopOfSections"b1"separatorBackdropOverlayBlendMode"b3"separatorsDrawInVibrantLightMode"b1"wrapCells"b1"showingIndexIndicatorOverlay"b1"showingIndexSelectionOverlay"b1"loadingOffscreenViews"b1"externalScreenHasTouch"b1"ignoringWheelEventsOnIndexOverlayIndicator"b1"deleteCancelationAnimationInProgress"b1"manuallyManagesSwipeUI"b1"allowsReorderingWhenNotEditing"b1"needsDeleteConfirmationCleanup"b1"resetContentOffsetAfterLayout"b1"cellsSelfSize"b1"usingCustomLayoutMargins"b1"settingDefaultLayoutMargins"b1"deallocating"b1"updateFocusAfterItemAnimations"b1"updateFocusAfterLoadingCells"b1"remembersLastFocusedIndexPath"b1"cellLayoutMarginsFollowReadableWidth"b1"sectionContentInsetFollowsLayoutMargins"b1}):(null)
2016-04-01 15:25:01.255 OCRumtiimInvoke[5077:257772] delegateDidSelectRow: 0
2016-04-01 15:25:01.255 OCRumtiimInvoke[5077:257772] _focusedCellIndexPath(@"NSIndexPath"):(null)
2016-04-01 15:25:01.255 OCRumtiimInvoke[5077:257772] _focusedCell(@"UIView"):(null)
2016-04-01 15:25:01.255 OCRumtiimInvoke[5077:257772] _indexPathToFocus(@"NSIndexPath"):(null)

```

我们注意到有这样一个变量名：`_tableFlags`，它的类型输出又是很大一串，我们基本可以肯定他是一个包含位域的结构体了，从它类型输出我们找到熟悉的字段『"delegateDidSelectRow"b1』，它表示的是delegate的方法`tableView:didSelectRowAtIndexPath:`的缓存标记，`b1`表示它占用了1个bit位。

至此，我们找到了标记delegate方法缓存的`_tableFlags`结构体，我可以利用`valueForKey:`从UITableView实例中获取到`_tableFlags`的内容了。

---
可是，别高兴得太早。当你尝试用[_tableView valueForKey:@"_tableFlags"];去拿`_tableFlags`的值的时候，这个方法总是返回nil。

原来，在Objective-C中是不支持位域结构体通过valueForKey返回的。至于为什么，我也不知道……

！！！那怎么办！！！（淡定，休息一下）

---
既然，我们得到了变量`_tableFlags`的类型描述字符串了，我们可以根据这个类型描述字符串构造一个这样的类型。（我是不是太聪明了- =）

我就分割了一下这个类型描述串，最后得到这个结构体

{% highlight objectivec %}
typedef unsigned int _Type;
typedef struct _TableViewFlags
{
    _Type dataSourceNumberOfRowsInSection : 1;
    _Type dataSourceCellForRow : 1;
    _Type dataSourceNumberOfSectionsInTableView : 1;
    _Type dataSourceTitleForHeaderInSection : 1;
    _Type dataSourceTitleForFooterInSection : 1;
    _Type dataSourceDetailTextForHeaderInSection : 1;
    _Type dataSourceCommitEditingStyle : 1;
    _Type dataSourceSectionIndexTitlesForTableView : 1;
    _Type dataSourceSectionForSectionIndexTitle : 1;
    _Type dataSourceCanEditRow : 1;
    _Type dataSourceCanMoveRow : 1;
    _Type dataSourceCanUpdateRow : 1;
    _Type dataSourceShouldShowMenu : 1;
    _Type dataSourceCanPerformAction : 1;
    _Type dataSourcePerformAction : 1;
    _Type dataSourceIndexPathForSectionIndexTitle : 1;
    _Type dataSourceWasNonNil : 1;
    _Type delegateEditingStyleForRowAtIndexPath : 1;
    _Type delegateTitleForDeleteConfirmationButtonForRowAtIndexPath : 1;
    _Type delegateEditActionsForRowAtIndexPath : 1;
    _Type delegateShouldIndentWhileEditing : 1;
    _Type dataSourceMoveRow : 1;
    _Type delegateCellForRow : 1;
    _Type delegateWillDisplayCell : 1;
    _Type delegateDidEndDisplayingCell : 1;
    _Type delegateDidEndDisplayingSectionHeader : 1;
    _Type delegateDidEndDisplayingSectionFooter : 1;
    _Type delegateHeightForRow : 1;
    _Type delegateHeightForSectionHeader : 1;
    _Type delegateTitleWidthForSectionHeader : 1;
    _Type delegateHeightForSectionFooter : 1;
    _Type delegateTitleWidthForSectionFooter : 1;
    _Type delegateEstimatedHeightForRow : 1;
    _Type delegateEstimatedHeightForSectionHeader : 1;
    _Type delegateEstimatedHeightForSectionFooter : 1;
    _Type delegateViewForHeaderInSection : 1;
    _Type delegateViewForFooterInSection : 1;
    _Type delegateDisplayedItemCountForRowCount : 1;
    _Type delegateDisplayStringForRowCount : 1;
    _Type delegateAccessoryTypeForRow : 1;
    _Type delegateAccessoryButtonTappedForRow : 1;
    _Type delegateWillSelectRow : 1;
    _Type delegateWillDeselectRow : 1;
    _Type delegateDidSelectRow : 1;
    _Type delegateDidDeselectRow : 1;
    _Type delegateWillBeginEditing : 1;
    _Type delegateDidEndEditing : 1;
    _Type delegateWillMoveToRow : 1;
    _Type delegateIndentationLevelForRow : 1;
    _Type delegateWantsHeaderForSection : 1;
    _Type delegateHeightForRowsInSection : 1;
    _Type delegateMargin : 1;
    _Type delegateHeaderTitleAlignment : 1;
    _Type delegateFooterTitleAlignment : 1;
    _Type delegateFrameForSectionIndexGivenProposedFrame : 1;
    _Type delegateDidFinishReload : 1;
    _Type delegateHeightForHeader : 1;
    _Type delegateHeightForFooter : 1;
    _Type delegateViewForHeader : 1;
    _Type delegateViewForFooter : 1;
    _Type delegateCalloutTargetRectForCell : 1;
    _Type delegateShouldShowMenu : 1;
    _Type delegateCanPerformAction : 1;
    _Type delegatePerformAction : 1;
    _Type delegateWillBeginReordering : 1;
    _Type delegateDidEndReordering : 1;
    _Type delegateDidCancelReordering : 1;
    _Type delegateWillDisplayHeaderViewForSection : 1;
    _Type delegateWillDisplayFooterViewForSection : 1;
    _Type delegateShouldHighlightRow : 1;
    _Type delegateDidHighlightRow : 1;
    _Type delegateDidUnhighlightRow : 1;
    _Type delegateTitleForSwipeAccessory : 1;
    _Type delegateBackgroundColorForDeleteConfirmationButton : 1;
    _Type delegateBackgroundColorForSwipeAccessory : 1;
    _Type delegateDeleteConfirmationButton : 1;
    _Type delegateSwipeAccessory : 1;
    _Type delegateSwipeAccessoryPushed : 1;
    _Type delegateShouldDrawTopSeparatorForSection : 1;
    _Type delegateWillBeginSwiping : 1;
    _Type delegateDidEndSwiping : 1;
    _Type delegateCanFocusRow_deprecated : 1;
    _Type delegateCanFocusRow : 1;
    _Type delegateDidFocusRow : 1;
    _Type delegateDidUnfocusRow : 1;
    _Type delegateShouldChangeFocusedItem : 1;
    _Type delegateIndexPathForPreferredFocusedItem : 1;
    _Type delegateShouldUpdateFocusFromRowAtIndexPathToView : 1;
    _Type delegateIndexPathForPreferredFocusedView : 1;
    _Type delegateShouldUpdateFocusInContext : 1;
    _Type delegateDidUpdateFocusInContext : 1;
    _Type delegateTemplateLayoutCell : 1;
    _Type delegateWillLayoutCellUsingTemplateLayoutCell : 1;
    _Type delegateWasNonNil : 1;
    _Type style : 1;
    _Type separatorStyle : 3;
    _Type wasEditing : 1;
    _Type isEditing : 1;
    _Type isEditingAllRows : 1;
    _Type scrollsToSelection : 1;
    _Type reloadSkippedDuringSuspension : 1;
    _Type updating : 1;
    _Type displaySkippedDuringSuspension : 1;
    _Type needsReload : 1;
    _Type updatingVisibleCellsManually : 1;
    _Type scheduledUpdateVisibleCells : 1;
    _Type scheduledUpdateVisibleCellsFrames : 1;
    _Type warnForForcedCellUpdateDisabled : 1;
    _Type displayTopSeparator : 1;
    _Type countStringInsignificantRowCount : 4;
    _Type needToAdjustExtraSeparators : 1;
    _Type overlapsSectionHeaderViews : 1;
    _Type ignoreTouchSelect : 1;
    _Type lastHighlightedRowActive : 1;
    _Type reloading : 1;
    _Type allowsSelection : 1;
    _Type allowsSelectionDuringEditing : 1;
    _Type allowsMultipleSelection : 1;
    _Type allowsMultipleSelectionDuringEditing : 1;
    _Type showsSelectionImmediatelyOnTouchBegin : 1;
    _Type indexHidden : 1;
    _Type indexHiddenForSearch : 1;
    _Type defaultShowsHorizontalScrollIndicator : 1;
    _Type defaultShowsVerticalScrollIndicator : 1;
    _Type sectionIndexTitlesLoaded : 1;
    _Type tableHeaderViewShouldAutoHide : 1;
    _Type tableHeaderViewIsHidden : 1;
    _Type tableHeaderViewWasHidden : 1;
    _Type tableHeaderViewShouldPin : 1;
    _Type hideScrollIndicators : 1;
    _Type sendReloadFinished : 1;
    _Type keepFirstResponderWhenInteractionDisabled : 1;
    _Type keepFirstResponderVisibleOnBoundsChange : 1;
    _Type dontDrawTopShadowInGroupedSections : 1;
    _Type forceStaticHeadersAndFooters : 1;
    _Type displaysCellContentStringsOnTapAndHold : 1;
    _Type displayingCellContentStringCallout : 1;
    _Type longPressAutoscrollingActive : 1;
    _Type adjustsRowHeightsForSectionLocation : 1;
    _Type inInit : 1;
    _Type inSetBackgroundColor : 1;
    _Type inCreateTemplateCell : 1;
    _Type usingCustomBackgroundView : 1;
    _Type rowDataIndexPathsAreValidForCurrentCells : 1;
    _Type committingDelete : 1;
    _Type didReloadWhileCommittingDelete : 1;
    _Type editingForSwipeDelete : 1;
    _Type wasEditingForSwipeToDeleteBeforeSuspendedReload : 1;
    _Type ignorePinnedTableHeaderUpdates : 1;
    _Type navigationGestureWasEnabledBeforeSwipeToDelete : 1;
    _Type didDisableNavigationGesture : 1;
    _Type separatorsDrawAsOverlay : 1;
    _Type swipeToDeleteRowIsBeingDeleted : 1;
    _Type drawsSeparatorAtTopOfSections : 1;
    _Type separatorBackdropOverlayBlendMode : 3;
    _Type separatorsDrawInVibrantLightMode : 1;
    _Type wrapCells : 1;
    _Type showingIndexIndicatorOverlay : 1;
    _Type showingIndexSelectionOverlay : 1;
    _Type loadingOffscreenViews : 1;
    _Type externalScreenHasTouch : 1;
    _Type ignoringWheelEventsOnIndexOverlayIndicator : 1;
    _Type deleteCancelationAnimationInProgress : 1;
    _Type manuallyManagesSwipeUI : 1;
    _Type allowsReorderingWhenNotEditing : 1;
    _Type needsDeleteConfirmationCleanup : 1;
    _Type resetContentOffsetAfterLayout : 1;
    _Type cellsSelfSize : 1;
    _Type usingCustomLayoutMargins : 1;
    _Type settingDefaultLayoutMargins : 1;
    _Type deallocating : 1;
    _Type updateFocusAfterItemAnimations : 1;
    _Type updateFocusAfterLoadingCells : 1;
    _Type remembersLastFocusedIndexPath : 1;
    _Type cellLayoutMarginsFollowReadableWidth : 1;
    _Type sectionContentInsetFollowsLayoutMargins : 1;
} _TableViewFlags;
这里在定义_Type类型的时候不建议用int，1个bit的int，在输出表示的时候，会被输出成『-1』或者『0』，1个bit的int这唯一的空间被拿去表示正负数了- =。
{% endhighlight objectivec %}

Objective-C的成员变量，我们可以通过`实例对象地址`+`成员变量地址偏移`获得。利用这个，我们就可以获取到`_tableFlags`的值了。我们改造一下刚刚的函数吧：

{% highlight objectivec %}
- (void)onButtonClicked:(id)sender
{
    Class curClass = NSClassFromString(@"UITableView");
    unsigned int numIvars; //成员变量个数
    Ivar *vars = class_copyIvarList(curClass, &numIvars);

    NSString *name = nil;
    NSString *type = nil;
    for(int i = 0; i < numIvars; i++) {

        Ivar thisIvar = vars[i];
        name = [NSString stringWithUTF8String:ivar_getName(thisIvar)];  //获取成员变量的名字
        type = [NSString stringWithUTF8String:ivar_getTypeEncoding(thisIvar)]; //获取成员变量的数据类型
        @try {
            NSLog(@"%@(%@):%@", name, type, [_tableView valueForKey:name]);
            if (!strcmp(name.UTF8String, "_tableFlags")) {
                typedef unsigned int _Type;
                typedef struct _TableViewFlags
                {
                    _Type dataSourceNumberOfRowsInSection : 1;
                    _Type dataSourceCellForRow : 1;
                    _Type dataSourceNumberOfSectionsInTableView : 1;
                    _Type dataSourceTitleForHeaderInSection : 1;
                    _Type dataSourceTitleForFooterInSection : 1;
                    _Type dataSourceDetailTextForHeaderInSection : 1;
                    _Type dataSourceCommitEditingStyle : 1;
                    _Type dataSourceSectionIndexTitlesForTableView : 1;
                    _Type dataSourceSectionForSectionIndexTitle : 1;
                    _Type dataSourceCanEditRow : 1;
                    _Type dataSourceCanMoveRow : 1;
                    _Type dataSourceCanUpdateRow : 1;
                    _Type dataSourceShouldShowMenu : 1;
                    _Type dataSourceCanPerformAction : 1;
                    _Type dataSourcePerformAction : 1;
                    _Type dataSourceIndexPathForSectionIndexTitle : 1;
                    _Type dataSourceWasNonNil : 1;
                    _Type delegateEditingStyleForRowAtIndexPath : 1;
                    _Type delegateTitleForDeleteConfirmationButtonForRowAtIndexPath : 1;
                    _Type delegateEditActionsForRowAtIndexPath : 1;
                    _Type delegateShouldIndentWhileEditing : 1;
                    _Type dataSourceMoveRow : 1;
                    _Type delegateCellForRow : 1;
                    _Type delegateWillDisplayCell : 1;
                    _Type delegateDidEndDisplayingCell : 1;
                    _Type delegateDidEndDisplayingSectionHeader : 1;
                    _Type delegateDidEndDisplayingSectionFooter : 1;
                    _Type delegateHeightForRow : 1;
                    _Type delegateHeightForSectionHeader : 1;
                    _Type delegateTitleWidthForSectionHeader : 1;
                    _Type delegateHeightForSectionFooter : 1;
                    _Type delegateTitleWidthForSectionFooter : 1;
                    _Type delegateEstimatedHeightForRow : 1;
                    _Type delegateEstimatedHeightForSectionHeader : 1;
                    _Type delegateEstimatedHeightForSectionFooter : 1;
                    _Type delegateViewForHeaderInSection : 1;
                    _Type delegateViewForFooterInSection : 1;
                    _Type delegateDisplayedItemCountForRowCount : 1;
                    _Type delegateDisplayStringForRowCount : 1;
                    _Type delegateAccessoryTypeForRow : 1;
                    _Type delegateAccessoryButtonTappedForRow : 1;
                    _Type delegateWillSelectRow : 1;
                    _Type delegateWillDeselectRow : 1;
                    _Type delegateDidSelectRow : 1;
                    _Type delegateDidDeselectRow : 1;
                    _Type delegateWillBeginEditing : 1;
                    _Type delegateDidEndEditing : 1;
                    _Type delegateWillMoveToRow : 1;
                    _Type delegateIndentationLevelForRow : 1;
                    _Type delegateWantsHeaderForSection : 1;
                    _Type delegateHeightForRowsInSection : 1;
                    _Type delegateMargin : 1;
                    _Type delegateHeaderTitleAlignment : 1;
                    _Type delegateFooterTitleAlignment : 1;
                    _Type delegateFrameForSectionIndexGivenProposedFrame : 1;
                    _Type delegateDidFinishReload : 1;
                    _Type delegateHeightForHeader : 1;
                    _Type delegateHeightForFooter : 1;
                    _Type delegateViewForHeader : 1;
                    _Type delegateViewForFooter : 1;
                    _Type delegateCalloutTargetRectForCell : 1;
                    _Type delegateShouldShowMenu : 1;
                    _Type delegateCanPerformAction : 1;
                    _Type delegatePerformAction : 1;
                    _Type delegateWillBeginReordering : 1;
                    _Type delegateDidEndReordering : 1;
                    _Type delegateDidCancelReordering : 1;
                    _Type delegateWillDisplayHeaderViewForSection : 1;
                    _Type delegateWillDisplayFooterViewForSection : 1;
                    _Type delegateShouldHighlightRow : 1;
                    _Type delegateDidHighlightRow : 1;
                    _Type delegateDidUnhighlightRow : 1;
                    _Type delegateTitleForSwipeAccessory : 1;
                    _Type delegateBackgroundColorForDeleteConfirmationButton : 1;
                    _Type delegateBackgroundColorForSwipeAccessory : 1;
                    _Type delegateDeleteConfirmationButton : 1;
                    _Type delegateSwipeAccessory : 1;
                    _Type delegateSwipeAccessoryPushed : 1;
                    _Type delegateShouldDrawTopSeparatorForSection : 1;
                    _Type delegateWillBeginSwiping : 1;
                    _Type delegateDidEndSwiping : 1;
                    _Type delegateCanFocusRow_deprecated : 1;
                    _Type delegateCanFocusRow : 1;
                    _Type delegateDidFocusRow : 1;
                    _Type delegateDidUnfocusRow : 1;
                    _Type delegateShouldChangeFocusedItem : 1;
                    _Type delegateIndexPathForPreferredFocusedItem : 1;
                    _Type delegateShouldUpdateFocusFromRowAtIndexPathToView : 1;
                    _Type delegateIndexPathForPreferredFocusedView : 1;
                    _Type delegateShouldUpdateFocusInContext : 1;
                    _Type delegateDidUpdateFocusInContext : 1;
                    _Type delegateTemplateLayoutCell : 1;
                    _Type delegateWillLayoutCellUsingTemplateLayoutCell : 1;
                    _Type delegateWasNonNil : 1;
                    _Type style : 1;
                    _Type separatorStyle : 3;
                    _Type wasEditing : 1;
                    _Type isEditing : 1;
                    _Type isEditingAllRows : 1;
                    _Type scrollsToSelection : 1;
                    _Type reloadSkippedDuringSuspension : 1;
                    _Type updating : 1;
                    _Type displaySkippedDuringSuspension : 1;
                    _Type needsReload : 1;
                    _Type updatingVisibleCellsManually : 1;
                    _Type scheduledUpdateVisibleCells : 1;
                    _Type scheduledUpdateVisibleCellsFrames : 1;
                    _Type warnForForcedCellUpdateDisabled : 1;
                    _Type displayTopSeparator : 1;
                    _Type countStringInsignificantRowCount : 4;
                    _Type needToAdjustExtraSeparators : 1;
                    _Type overlapsSectionHeaderViews : 1;
                    _Type ignoreTouchSelect : 1;
                    _Type lastHighlightedRowActive : 1;
                    _Type reloading : 1;
                    _Type allowsSelection : 1;
                    _Type allowsSelectionDuringEditing : 1;
                    _Type allowsMultipleSelection : 1;
                    _Type allowsMultipleSelectionDuringEditing : 1;
                    _Type showsSelectionImmediatelyOnTouchBegin : 1;
                    _Type indexHidden : 1;
                    _Type indexHiddenForSearch : 1;
                    _Type defaultShowsHorizontalScrollIndicator : 1;
                    _Type defaultShowsVerticalScrollIndicator : 1;
                    _Type sectionIndexTitlesLoaded : 1;
                    _Type tableHeaderViewShouldAutoHide : 1;
                    _Type tableHeaderViewIsHidden : 1;
                    _Type tableHeaderViewWasHidden : 1;
                    _Type tableHeaderViewShouldPin : 1;
                    _Type hideScrollIndicators : 1;
                    _Type sendReloadFinished : 1;
                    _Type keepFirstResponderWhenInteractionDisabled : 1;
                    _Type keepFirstResponderVisibleOnBoundsChange : 1;
                    _Type dontDrawTopShadowInGroupedSections : 1;
                    _Type forceStaticHeadersAndFooters : 1;
                    _Type displaysCellContentStringsOnTapAndHold : 1;
                    _Type displayingCellContentStringCallout : 1;
                    _Type longPressAutoscrollingActive : 1;
                    _Type adjustsRowHeightsForSectionLocation : 1;
                    _Type inInit : 1;
                    _Type inSetBackgroundColor : 1;
                    _Type inCreateTemplateCell : 1;
                    _Type usingCustomBackgroundView : 1;
                    _Type rowDataIndexPathsAreValidForCurrentCells : 1;
                    _Type committingDelete : 1;
                    _Type didReloadWhileCommittingDelete : 1;
                    _Type editingForSwipeDelete : 1;
                    _Type wasEditingForSwipeToDeleteBeforeSuspendedReload : 1;
                    _Type ignorePinnedTableHeaderUpdates : 1;
                    _Type navigationGestureWasEnabledBeforeSwipeToDelete : 1;
                    _Type didDisableNavigationGesture : 1;
                    _Type separatorsDrawAsOverlay : 1;
                    _Type swipeToDeleteRowIsBeingDeleted : 1;
                    _Type drawsSeparatorAtTopOfSections : 1;
                    _Type separatorBackdropOverlayBlendMode : 3;
                    _Type separatorsDrawInVibrantLightMode : 1;
                    _Type wrapCells : 1;
                    _Type showingIndexIndicatorOverlay : 1;
                    _Type showingIndexSelectionOverlay : 1;
                    _Type loadingOffscreenViews : 1;
                    _Type externalScreenHasTouch : 1;
                    _Type ignoringWheelEventsOnIndexOverlayIndicator : 1;
                    _Type deleteCancelationAnimationInProgress : 1;
                    _Type manuallyManagesSwipeUI : 1;
                    _Type allowsReorderingWhenNotEditing : 1;
                    _Type needsDeleteConfirmationCleanup : 1;
                    _Type resetContentOffsetAfterLayout : 1;
                    _Type cellsSelfSize : 1;
                    _Type usingCustomLayoutMargins : 1;
                    _Type settingDefaultLayoutMargins : 1;
                    _Type deallocating : 1;
                    _Type updateFocusAfterItemAnimations : 1;
                    _Type updateFocusAfterLoadingCells : 1;
                    _Type remembersLastFocusedIndexPath : 1;
                    _Type cellLayoutMarginsFollowReadableWidth : 1;
                    _Type sectionContentInsetFollowsLayoutMargins : 1;
                } _TableViewFlags;
                _TableViewFlags *p = (__bridge void *)_tableView + ivar_getOffset(thisIvar);
                NSLog(@"delegateDidSelectRow: %d", p->delegateDidSelectRow);
            }
        } @catch (NSException *exception) {
            NSLog(@"%@", exception);
        } @finally {
            ;
        }
    }
    free(vars);
}
{% endhighlight objectivec %}

为了验证我的想法，进行了两次程序调用：
* 加载我的JSPatch文件，看`delegateDidSelectRow`的值。
* 不加载JSPatch文件，看`delegateDidSelectRow`的值。

最后的输出也成功验证了我的想法，加载JSPatch文件后，`delegateDidSelectRow`是1，没有加载的情况下，输出了0。

至此，整个探索过程完毕。

---

## 至于为什么Apple要在我们设置delegate的时候对delegate的方法进行一次询问并缓存询问的结果呢

我想每次运行到需要调用delegate的方法的时候就去调用一次`respondsToSelector:`去询问的代价相比一开始就把询问结果给缓存起来的代价要大很多。缓存后，运行时，只需要查询缓存结果就知道需不需要调用delegate的方法，这个速度会快很多！

毕竟也没有谁像我一样在运行时去添加一个`UITableViewDataSource或UITableViewDelegate`中在编译时不存在的方法吧。

## 适时更新TableFlag缓存
得到这些信息后，我们在加载完JSPatch后更改一下对应缓存的值就行了。或许，你会觉得直接重新对delegate进行一次赋值不就好了吗。就像这样

{% highlight objectivec %}
_tableView.delegate = nil;
_tableView.dataSource = nil;
_tableView.delegate = self;
_tableView.dataSource = self;
{% endhighlight objectivec %}
好吧，我承认这样一样有效，但是我不能保证这样没有副作用。建议还是直接更新缓存吧！直接更新缓存肯定比重新赋值要快很多！

## 修订记录
* 2016-04-01 16:08:07 第一次完稿
* 2016-04-01 16:22:40 修正用词