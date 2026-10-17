# 课程切换组件

`lesson-switcher.js` 导出原生 ES Module 组件 `createLessonSwitcher`，自动导入独立样式 `lesson-switcher.css`。无框架依赖；挂载容器负责位置与宽度，组件负责当前名称、下拉菜单和交互。

```js
import {createLessonSwitcher} from './components/lesson-switcher.js';

const picker=createLessonSwitcher(document.querySelector('.lesson-nav'),{
  lessons:manifest.lessons, // [{ id, title }]，使用完整课程标题
  value:'conveyor',
  onChange(id){location.hash='/'+id;}
});

// 页面路由选定课件后同步；直接链接、前进和后退共用这条路径。
picker.setValue(activeId);

// 宿主页面卸载组件时，移除 DOM 和包括 document 监听器在内的全部事件。
picker.destroy();
```

`lessons` 需为非空清单、ID唯一；`value` 默认首项。`onChange` 只请求切换，选中值由宿主通过 `setValue` 确认；选择当前课程仅关闭菜单，不重新创建实验。组件不读取 URL，不操作三维场景。新实例可使用不同清单；组件不依赖课件的固定 ID。

按钮支持 Enter / 空格展开，方向键定位、Home / End 跳至首尾、Enter / 空格选择，Esc 收起并恢复按钮焦点，Tab 离开或点击外部收起。菜单采用 `menuitemradio` 标记当前课程；组件内的键盘事件不会触发实验播放或相机快捷键。课程名使用 `textContent` 写入。

独立样式提供悬停、焦点、选中和展开状态，并响应减少动态偏好；长清单可内部滚动。布局定位仍在宿主的 `src/style.css` 中管理。
