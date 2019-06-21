# clojure-lint Extension

`clojure-link` is an extension for [VSCode](https://code.visualstudio.com/) that lints Clojure files.

## Features

The extension lints Clojure and EDN code using [`clj-kondo`](https://github.com/borkdude/clj-kondo).

![Problems pane](https://user-images.githubusercontent.com/448001/59565149-79ad7780-9047-11e9-9dcf-d8776a2b0814.png)


## Requirements

1. `clj-kondo` must be [installed](https://github.com/borkdude/clj-kondo/blob/master/doc/install.md) and available on the `PATH`.
2. At this time, macOS and Linux are supported. [Runing GraalVM on Windows has some issues](https://github.com/borkdude/clj-kondo/issues/276).

## Release Notes

### 0.2.0
- Only run on Clojure files.
- Provide links to [Issues](https://github.com/marcomorain/clojure-lint/issues) page when errors occur.
- Ensure `.clj-kondo/config.edn` is loaded correctly.
### 0.1.0
- Added message telling the user how to install `clj-kondo`.
- Licensed under GPLv3.
### 0.0.1
- First published.
