---
layout: post
title: iOS collection view不能被点击的原因
categories: [Swift]
comments: true
tags: [iOS]
---


* cell上有responser拦截了点击事件导致不能传递给collection View，比如cell上有button，或者一个`view.isUserInteractionEnabled = true`
* 有手势覆盖了collection view的frame，这样也可能导致事件无法继续传递
* 重写了方法`collectionView(:shouldHighlightItemAt:)`，不是说不能重写这个方法，如果在这个方法中返回false，就不会触发`collectionView(:didSelectItemAt:)`。
<!--more-->

## Bug分析回溯

emmm，这几天我就栽在上面第3点了。我在`collectionView(_:shouldHighlightItemAt:)`中return了 `isPlaceholder == false`，这是前提。

由于我在用Swift重构APP首页的[C]代码。在对于数据模型上，bool啥的在栈上的变量在[C]中new出来默认就是0，值转义后就是NO，判断bool的时候`isPlaceholder == NO`就可以了；在Swift中的数据模型只能用Optional变量来表示optional（听起来怪怪的，其实如果你用过[C]的JSONModel就知道啥意思），用Optional才能保证在解析JSON的时候，服务端没有给传递isPlaceholder的键值对，不会抛出异常。

Optional是个好东西，所以我就给首页某个model的isPlaceholder设为Optional<Bool>，即`var isPlaceholder: Bool?`，在判断的时候，`isPlaceholder == false`，它等价于[C]的`isPlaceholder == NO`.................吗？可惜了，并不等价。

我在内部曾分享过“Swift的Optional的链式调用，结果为nil”的情况，Optional的链式调用中只要有一环出现了nil，那么结果就是nil，不管链式调用的末端是什么类型，而且我们还不能用[C]的思维认为nil就是false。

在Swift中支持if-let unwrap表达，即如果let表达式出现了nil就不会进入if-true的分支，这里编译器作了自动转换；对表达式返回bool类型的，比如 xxx == false，xxx == 1，xxx允许是一个Optional，如果xxx是nil，表达式就是false。

所以当我用[C]的思维去写Swift中的`isPlaceholder == false`的时候，以为isPlaceholder为nil的时候也会返回true。所以才造成了无法触发collection view的didSelect回调。