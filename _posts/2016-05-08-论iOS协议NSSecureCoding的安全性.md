---
layout: post
title: 论iOS协议NSSecureCoding的安全性
categories: [iOS]
comments: true
tags: [iOS]
---

我们知道`NSSecureCoding`协议可以完成一个Objective-C类的加密工作。我们只需要在一个类中实现`NSSecureCoding`协议的方法，通过调用`NSKeyedArchiver`类`+ (NSData *)archivedDataWithRootObject:;`就可以生成加密后的数据。然后通过`NSKeyedUnarchiver`的`+ (nullable id)unarchiveObjectWithData:;`方法来反解数据。例如这样：
{% highlight objectivec %}
NSDictionary *security = @{/*some data*/}; // NSDictionary已经实现了NSSecureCoding协议。
NSData *d = [NSKeyedArchiver archivedDataWithRootObject:security]; // 加密数据
id rt = [NSKeyedUnarchiver unarchiveObjectWithData:d]; // 解密数据，并还原到类实例。
{% endhighlight objectivec %}
<!--more-->

可是你可知道这种方式并不安全。笔者今天就通过反解天猫商城的地址数据`addressManager.data`来探讨`NSSecureCoding`协议的安全性。

## 前言
某天，笔者接到需求，需要做一个类似电商的全国地址选择器（参考京东商城，天猫商城的收货地址管理界面的地址选择）。界面好做，但是全国地址数据，居然是没有人提供的，需要自己去找。随便去网上找一个sql语句导入数据库，但是不是很齐全，而且有纰漏，比如有的区县已经是省直辖区县了，但是没有更新。万般无奈之下，注意到了做电商出家的天猫商城，它上面的地址数据就很齐全。于是我就有想从它的APP安装包中查找地址数据的想法。因为一般来说，地址数据是打包进APP安装包的。

## 解压天猫APP
打开iTunes，搜索天猫，下载天猫到电脑本机。下载完成后，在`我的iPhone应用`下找到天猫APP，右键选择`在Finder中显示`，就会定位到天猫安装包的文件位置。

![](/assets/2016-05-08-论iOS协议NSSecureCoding的安全性//locatedFinder.png)

接下来，将`天猫.ipa`重命名为`天猫.ipa.zip`，然后双击，就可以解压ipa了。

![](/assets/2016-05-08-论iOS协议NSSecureCoding的安全性//decompress.png)

然后按照接下来的路径找到`Tmall4iPhone.app`

![](/assets/2016-05-08-论iOS协议NSSecureCoding的安全性//find.png)

右键选择`显示包内容`，我们就进入天猫打包的资源文件夹了。接着我们在该文件夹下查找与`地址管理，地址数据`相关的文件。经过仔细筛查，我们发现了`addressManager.data`这个文件。我们尝试用文本编辑器打开，却发现编辑器并不支持，看来，天猫把它加密保存了。然后我们直接用十六进制查看器`iHex`。

![](/assets/2016-05-08-论iOS协议NSSecureCoding的安全性//hex.png)

我们看到了熟悉的英文单词`archiver`。我们知道`NSKeyedArchiver`是用来把Objective-C类保存到磁盘上的工具类。刚好又出现了`archiver`。

于是，我就想到了，直接用`NSKeyedUnarchiver`来解密。但是我们需要原始Objective-C类才能顺利反解出数据来。

其实，并没有那么麻烦，我们就利用`NSKeyedUnarchiver`的异常机制，根据异常机制，来获取一些报错信息。

## 反解类名
我们直接写一个`莫名其妙的`类。
{% highlight objectivec %}
@interface Unknown : NSObject

@end

@implementation Unknown

@end
{% endhighlight objectivec %}

是的，就这么简洁。不需要任何成员变量，连类名都可以简单取。然后读取数据，用`NSKeyedUnarchiver`来反解试试！

{% highlight objectivec %}
NSString *path = [CHSystemUtil privateDocumentsPath];
NSString *filePath = [path stringByAppendingPathComponent:@"addressManager.data"];
NSArray<Unknown *> *data = [NSKeyedUnarchiver unarchiveObjectWithFile:filePath];
NSLog(@"%@", data);
{% endhighlight objectivec %}
运行一下。
![](/assets/2016-05-08-论iOS协议NSSecureCoding的安全性//try0.png)

果不其然，直接抛异常了。然而这个异常，却给了我们足够的信息！

`cannot decode object of class (TBAreaEX) for key (NS.objects); the class may be defined in source code or a library that is not linked`，这份异常信息已经告诉我们原始的Objective-C类的类名是`TBAreaEX`。好的，我们就把这个名字替换我们之前的类名`Unknown`，并且实现`NSSecureCoding`协议。

{% highlight objectivec %}
@interface TBAreaEX : NSObject <NSSecureCoding>

@end

@implementation TBAreaEX

+ (BOOL)supportsSecureCoding
{
    return YES;
}

- (instancetype)initWithCoder:(NSCoder *)aDecoder
{
    if (self = [super init]) {
    }
    return self;
}

- (void)encodeWithCoder:(NSCoder *)aCoder
{
}
{% endhighlight objectivec %}
因为，我们还不知道TBAreaEX中有哪些成员变量，所以暂时这么写。然后我们运行一下，这下就没有报错了。

## 反解成员变量
至此，我们还是不知道`TBAreaEX`到底拥有什么成员变量，成员变量的名字，类型，我们都还一无所知。

这时候，我们需要回到原始数据文件`addressManager.data`上，我们已经知道类名是`TBAreaEX`，所以我们可以尝试在这份数据里搜索`TBAreaEX`，看有没有什么收获。

![](/assets/2016-05-08-论iOS协议NSSecureCoding的安全性//try1.png)

我们成功搜索到了`TBAreaEX`，我们大胆假设，成员变量的名字应该在它出现位置的上面或者下面，我们仔细找找。

![](/assets/2016-05-08-论iOS协议NSSecureCoding的安全性//try2.png)

最终我们看到了一些比较在意的字符串。`post code leaf name children`看起来和地址的要素很是相关呢。`post`就是邮编，`code`应该是地区编号，`leaf`目前尚不清楚，`name`就是省市区的名字，`children`就是某省的城市集合，或者是某市的区县集合了。

成员变量的名字就算是找到了，但是类型呢。`name`应该是`NSString`没错。`post`和`code`就不一定了，有可能是整型，也有可能字符串类型。这些猜测，似乎有道理，但是我们忘记了Objective-C是运行时决定变量类型的。故，我们不需要管类型，直接将成员变量声明为`id`类型即可。

 > 也可以指定类型。如果类型错了，系统会抛出异常，异常里面会带有正确类型的信息。

于是，我们就可以把这些数据补充到我们写的`TBAreaEX`中。
{% highlight objectivec %}
@interface TBAreaEX : NSObject <NSSecureCoding>

@property (nonatomic, strong) id post;
@property (nonatomic, strong) id code;
@property (nonatomic, strong) id name;
@property (nonatomic, strong) id children;

@end

@implementation TBAreaEX

+ (BOOL)supportsSecureCoding
{
    return YES;
}

- (instancetype)initWithCoder:(NSCoder *)aDecoder
{
    if (self = [super init]) {
        _post = [aDecoder decodeObjectForKey:@"post"];
        _code = [aDecoder decodeObjectForKey:@"code"];
        _name = [aDecoder decodeObjectForKey:@"name"];
        _children = [aDecoder decodeObjectForKey:@"children"];
    }
    return self;
}

- (void)encodeWithCoder:(NSCoder *)aCoder
{
    [aCoder encodeObject:_post forKey:@"post"];
    [aCoder encodeObject:_code forKey:@"code"];
    [aCoder encodeObject:_name forKey:@"name"];
    [aCoder encodeObject:_children forKey:@"children"];
}

@end
{% endhighlight objectivec %}
然后运行我们的程序。结果如下图所示

![](/assets/2016-05-08-论iOS协议NSSecureCoding的安全性//try3.png)

这些数据说明了，`post和code`是`NSString`类型，而children是一个数组（其实从数据结构上来说，它应该就是一个数组了，而且我们还可以肯定它存的就是`TBAreaEX`类）从图中数据，也证实了我们的想法。我们还是按照这个类型去改造我们的`TBAreaEX`类信息。
{% highlight objectivec %}
@interface TBAreaEX : NSObject <NSSecureCoding>

@property (nonatomic, strong) NSString *post;
@property (nonatomic, strong) NSString *code;
@property (nonatomic, strong) NSString *name;
@property (nonatomic, strong) NSArray<TBAreaEX *> *children;

@end

@implementation TBAreaEX

+ (BOOL)supportsSecureCoding
{
    return YES;
}

- (instancetype)initWithCoder:(NSCoder *)aDecoder
{
    if (self = [super init]) {
        _post = [aDecoder decodeObjectForKey:@"post"];
        _code = [aDecoder decodeObjectForKey:@"code"];
        _name = [aDecoder decodeObjectForKey:@"name"];
        _children = [aDecoder decodeObjectForKey:@"children"];
    }
    return self;
}

- (void)encodeWithCoder:(NSCoder *)aCoder
{
    [aCoder encodeObject:_post forKey:@"post"];
    [aCoder encodeObject:_code forKey:@"code"];
    [aCoder encodeObject:_name forKey:@"name"];
    [aCoder encodeObject:_children forKey:@"children"];
}

@end
{% endhighlight objectivec %}

运行之后，我们就可以得到天猫加密后的地址数据了。

## 无法反解的变量
其中有一个变量`leaf`，我尝试过用`id`去读取它的值，然而我失败了。可能是另外的存取方式，而且很有可能就是天猫存的街道数据。根据UTF-8的编码方式，我尝试搜索了`东华`（北京市东城区的东华门街道）是可以在`addressManager.data`中搜索到的。这也算是天猫给我们隐藏的小小『惊喜』吧。

如果你找到了破解方法一定要告诉我啊！

## 结论
综上，我们可以看出，即使天猫对数据用Apple的`NSSecureCoding`协议加密了，我们还是可以通过简单的反解得到数据。天猫作为这么大的企业，应该是意识到这个问题，可能只是给获得数据的我们设置一道门槛，不让轻易获得数据，即使获得了，也算是一种认可吧，毕竟还有个`leaf`字段还没有被反解出来呢。

`NSSecureCoding`的加密方式不可靠，所以对于比较重要的数据就不要采用这个协议加密了。

## NSSecureCoding的改进
* 我们可以把`[aCoder encodeObject:_post forKey:@"post"];`的`post`字符串改成其它无人类语言化的字符组合。
* 上面的方面治标不治本。因为我们可以根据`NSSecureCoding`中的`T`分隔符找到关键key。所以，我们从`addressManager.data`中可以看到，`post`和`code`即成员变量的间隔是用字符`T`来分割，那么我们就可以利用这个用`TTTTTTT`N个'T'来作为NSCoder的key，让破解查找关键字变得费力！例如：

{% highlight objectivec %}
- (void)encodeWithCoder:(NSCoder *)aCoder
{
    [aCoder encodeObject:_post forKey:@"TTTTTTTTTTTTTT"];
    [aCoder encodeObject:_code forKey:@"TTTTTTTTTTT"];
    [aCoder encodeObject:_name forKey:@"TTTTTTT"];
    [aCoder encodeObject:_children forKey:@"TTTTTTTTTTT"];
}
{% endhighlight objectivec %}
    
* 我们可以根据类名的偏移量找到关键字，而且用N个`T`的key，可以在O(N * k)（k是key的个数，N是key的最长长度）的时间复杂度中找出。鉴于此，我们可以把这份文件我们再加密一次。这样做的话，又增加了加密函数编写的难度。所以我推荐第二种方式足矣。

# 修订记录
* 2016-05-08 01:25:59 第一次完稿
* 2016-05-08 01:39:40 修正
* 2016-05-09 13:56:20 添加『NSSecureCoding的改进』和『结论』