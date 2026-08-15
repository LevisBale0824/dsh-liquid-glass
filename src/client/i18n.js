    // Layer: zh/en settings copy.
    function isZh() {
      var lang = (document.documentElement.lang || navigator.language || '').toLowerCase()
      return lang.indexOf('zh') === 0
    }

    function copy(key) {
      var zh = {
        background: '背景图片',
        ice: '冰原',
        deepwater: '深水',
        custom: '我的图片',
        import: '导入图片',
        remove: '移除图片',
        customFull: '最多保存 6 张导入图片',
        libraryBudget: '导入图片总容量不足，请先移除一张图片',
        opacity: '壁纸透明度',
        blur: '玻璃模糊',
        glass: '液态玻璃',
        glassOn: '已开启',
        glassOff: '已关闭',
        switched: '已切换背景',
        tuned: '已更新背景',
        imported: '已导入并保存本地图片',
        persistFail: '已应用，但浏览器未能保存设置',
        processing: '正在处理图片…',
      }
      var en = {
        background: 'Wallpaper',
        ice: 'Ice',
        deepwater: 'Deepwater',
        custom: 'My image',
        import: 'Import image',
        remove: 'Remove',
        customFull: 'You can keep up to 6 imported images',
        libraryBudget: 'Not enough space for imported images; remove one first',
        opacity: 'Wallpaper opacity',
        blur: 'Glass blur',
        glass: 'Liquid Glass',
        glassOn: 'On',
        glassOff: 'Off',
        switched: 'Wallpaper updated',
        tuned: 'Wallpaper tuned',
        imported: 'Imported and saved locally',
        persistFail: 'Applied, but the browser could not save it',
        processing: 'Processing image…',
      }
      return (isZh() ? zh : en)[key]
    }
