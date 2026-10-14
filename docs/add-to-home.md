# 添加到手机桌面

全站页面共享一个site.webmanifest与同一应用标识。入口在导航品牌旁，手机右上角；点击显示iPhone/安卓操作说明，桌面显示本地生成的二维码。iPhone/iPad推荐Safari分享菜单“添加到主屏幕”；微信等内置浏览器先选择在浏览器打开。支持beforeinstallprompt时由用户点击按钮调起原生安装；拒绝、失败或不支持时保留手动步骤，不声称已经安装。

桌面图标使用“国金商社”四字与网站品牌色，提供192/512 PNG、独立maskable图标及180 Apple触摸图标。入口统一指向industry.html，图标打开采用standalone。已处于standalone、iOS navigator.standalone或收到appinstalled事件时隐藏添加入口。嵌入行业iframe不重复显示。

没有注册Service Worker，不缓存行情、网页或数据文件；每次打开仍沿用网站原有在线更新。添加到桌面不提供离线数据能力，也不需要客户账号或本地收藏。网页不能代替客户确认系统的添加操作。

依据：[MDN安装条件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)、[安装事件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt)、[Apple主屏幕操作](https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iphea86e5236/ios)。实际安装UI由手机系统及浏览器决定。

验证：运行node tests/site-install.browser.cjs，测试iOS/安卓/微信说明、原生提示接受/拒绝/失败、已安装状态、键盘关闭、复制失败、iframe、手机布局和真实manifest图标。手机真机的系统安装需由用户确认，浏览器模拟测试不等同于完成真机安装。
