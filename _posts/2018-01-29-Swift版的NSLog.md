---
layout: post
title: Swift版的NSLog
categories: [Swift]
comments: true
tags: [Swift]
---

在[C]中，我们可以用宏定义来配置NSLog函数以控制它在发版（release）的时候失去作用，即不往stdout里写数据；更重要的是对NSLog传入的参数也不会写到APP里，这项很重要，我们都不想把调试的信息也打包进APP二进制里。
<!--more-->

~~~ c
#ifdef DEBUG
#define NSLog(...) NSLog(__VA_ARGS__)
#else
#define NSLog(...)
#endif
~~~
这是一个运用很广的宏技巧，它可以保证debug的时候NSLog正常运作，而在其它时候NSLog就什么都不做。

但是，Swift对宏的支持不是很友善，只能通过-D flag配置简单的宏。那么如何写出Swift里的NSLog呢？我有以下思路。

**1、通过clang的编译Attribute控制**

Swift的assert函数只在-Onone选项下有效，而在-O下就会被编译器优化掉，我觉得可以从Swift的assert函数入手，去GitHub上看源码

{% highlight swift %}
@_inlineable // FIXME(sil-serialize-all)
@_transparent
public func assert(
  _ condition: @autoclosure () -> Bool,
  _ message: @autoclosure () -> String = String(),
  file: StaticString = #file, line: UInt = #line
) {
  // Only assert in debug mode.
  if _isDebugAssertConfiguration() {
    if !_branchHint(condition(), expected: true) {
      _assertionFailure("Assertion failed", message(), file: file, line: line, flags: _fatalErrorFlags())
    }
  }
}
{% endhighlight swift %}

发现assert方法有2个编译属性: @_inlineable @_transparent，inlineable好理解，transparent就有点不懂了。搜索一番得知，transparent属性要求被标记的方法必须是public的，被标记的方法的内部的汇编代码对调用者是可见的（从编译器的角度来说），这样编译器在优化的时候就知道哪些汇编代码是可以去除的。感觉@_transparent靠谱，给Log函数加上_transparent。

{% highlight swift %}
@_transparent
func Log(_ items: Any..., separator: String = " ", terminator: String = "\n", file: String = #file, line: Int = #line) { ... }
Log("Recycle doooooo")
let a = 50
Log("a is \(a)")
{% endhighlight swift %}

然而，写了几个测试调用，在release下编译生成后用Hopper查看汇编代码。虽然Log函数整个消失，未发现有调用迹象，但发现传入的String “Recycle doooooo”依然躺在那儿。
![](/assets/2018-01-29-Swift版的NSLog/assemble.jpg)
依样画葫芦失败。至此，回顾assert的注释文档，可以得出，assert的优化是编译器主动行为，也就是说我们不能命令编译器说这个函数需要在release无效。

**2、脚本替换**

在打包的时候运行脚本把所有Log函数的调用注释掉，简单粗暴。这样使用外部力量来控制代码的效果始终不是最优选择。

**3、通过Swift优化器的优化规则**

在-O选项下编译器会对空的函数（没有执行体）进行置空处理，就当它不存在。但如果这种函数的入参是运行时计算的，那么就会保留入参的计算，例如Log("a is \(a)")带计算属性代码，会被保留计算过程（合成String）。在Swift3之后，Swift新增了一个关键字`@autoclosure`，它配合闭包使用，`@autoclosure`可以让我们延迟计算闭包内的代码，由函数体决定何时调用（或者不调用）。在release下，我们可以这样写Log函数：

{% highlight swift %}
func Log(_ items: @autoclosure () -> Any, separator: String = " ", terminator: String = "\n") { }
let a = 50
Log("a is \(a)")
{% endhighlight swift %}

将items的类型变为自动闭包，函数本身什么都不做。当编译器遇见空函数体且延迟计算的闭包在函数体没有用到，就会把闭包优化置空。所以Log("a is \(a)")中的计算也不会在运行时出现，那么字符串也就不存在了。

最终，通过`@autoclosure`和Swift优化器帮助我们完成了Swift版本的NSLog。 