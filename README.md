<p align="center">
  <a href="https://arte0s.github.io/zoox">
    <a href="https://arte0s.github.io/zoox"><img src="https://arte0s.github.io/zoox/logo.svg" width="220" height="116" alt="Zoox logo"></a>
  </a>
</p>

# zoox.js

> ZooxJS is a tiny framework for single file components

- [i18n demo](https://arte0s.github.io/zoox/demo/test-button.html)
- [Lazy init demo](https://arte0s.github.io/zoox/demo/test-lazy-init.html)
- [Checkboxes demo](https://arte0s.github.io/zoox/demo/test-checkbox.html)
- [Modal window demo](https://arte0s.github.io/zoox/demo/test-modal.html)

## Goals & Features

 - A lightweight and scalable
 - No dependencies
 - Control inheritance and encapsulation
 - Built-in internationalization
 - Lazy initialization

## API

### Main API (global functions)

- `zoox.init` - Framework initialization handler
- `zoox.utils.toArray` - Convert an HTMLCollection to an Array
- `zoox.setLang` - Set current language
- `zoox.getLangs` - Get all languages
- `zoox.getLang` - Get current language

### Control  API (object returns in 'zoox.init' or 'onInit' function of parent)

- `get` - Get child control by UID
- `getAll` - Get all child controls
- `getId` - Get generated control UID
- `getHTML` - Get HTML markup
- `display` - Add control to the DOM
- `hide` - Remove control from the DOM
- `setText` - Set texts for text element (for i18n)
- `refreshTexts` - Refresh texts for text elements
- `setInitHandler` - Set handler fot initializition event
- `setLazyHandler` - Set handler fot child lazy initializition event
- `setDisplayHandler` - Set handler fot displaye event
- `setHideHandler` - Set handler fot hide event
- `create` - Create new control
- `copy` - Copy control

## Usage

### Example

1.Create your component in one html file with prefix `z-` (for example `z-my-button.html`)

```html
<html>

<head>
    <style>
        ...
    </style>

    <script>
        //Function calls at the end of initialization
        zxBase.onInit = () => {
            //...
        };

        //You can define any other function
        zxBase.setCaption = t => {
            //...
        };
    </script>
</head>

<body>
    <button>
        <z-slot>default implementation</z-slot>
    </button>
</body>

</html>
```

2.Add framework to the page

```html
<script type="text/javascript" src="path/to/zoox.js"></script>
```

3.Add framework initialization handler code to HEAD tag

```html
<head>
    <script>
        zoox.init({
            path: '../controls/',
            langs: ['ru', 'en'],
            init: zxBase => {}
        });
    </script>
</head>
```

4. Add components to BODY tag

```html
<body>
    <z type="my-button">Button caption</z>
</body>
```

## License

[MIT](https://github.com/arte0s/zoox/blob/master/LICENSE)