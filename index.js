const pluginName = 'gulp-webp-css';
const PluginError = require('gulp-util/lib/PluginError');
const through = require('through2');
var CSSParser = require('css');

var supportsRender = function (rulesArr) {
    return "\n@supports (-webkit-appearance:none){\n" + rulesArr.join("\n") + "\n}\n"
}
module.exports = function(extensions){
    var extensions = extensions || ['.jpg','.png','.jpeg','JPG','.gif'];
    return through.obj(function(file, enc, cb) {
        if (file.isNull()) {
            cb(null, file);
            return;
        }

        if (file.isStream()) {
            cb(new PluginError(pluginName, 'Streaming not supported'));
            return;
        }

        try {
            var css = file.contents.toString();
            var obj = CSSParser.parse(css);

            if (!obj) return;

            var getWebpRulesArr = function (arr) {
                var supportsLine = function(selectors, rule){
                    var line = selectors + '{' + rule + '}';
                    return line;
                }

                var retn = {
                    supportsArrStr: [],
                    media: {}
                }

                Object.keys(arr).forEach(function (k) {
                    var rule = arr[k];
                    // Если CSS правило
                    if(rule.type == 'rule'){
                        var declarations = rule.declarations;
                        // Перебираем декларации
                        Object.keys(declarations).forEach(function (i) {
                            var declaration = declarations[i];
                            // Если находим background: url без .webp
                            if ((declaration.property.indexOf('background') + 1) && (declaration.value.indexOf('url') + 1) && !(declaration.value.indexOf('.webp') + 1)){
                                var newValue = declaration.value;
                                // Заменяем на webp
                                for(ext in extensions){
                                    newValue = newValue.replace(extensions[ext],'.webp');
                                }
                                // Формируем строку и пушим в массив дополнений
                                var currentSelector = rule.selectors.join(',');
                                var newRule = declaration.property + ':' + newValue;
                                var pushStr = supportsLine(currentSelector,newRule);
                                retn.supportsArrStr.push(pushStr);
                            }
                        });
                    // Если медиа-запрос
                    }else if(rule.type == 'media'){
                        var retnStr = getWebpRulesArr(rule.rules);
                        if (!!retn.media[rule.media]){
                            retn.media[rule.media] = retn.media[rule.media].concat(retnStr.supportsArrStr);
                        }else{
                            retn.media[rule.media] = retnStr.supportsArrStr;
                        }
                    }
                });
                return retn;
            }

            // Получаем доп правила
            var newrules = getWebpRulesArr(obj.stylesheet.rules);
            // Собираем строку
            var newRulesStr = supportsRender(newrules.supportsArrStr);
            // Добавляем медиа-правила
            for(k in newrules.media){
                newRulesStr += "\n @media " + k + "{\n" + supportsRender(newrules.media[k]) + "\n}\n";
            }
            
            const data = file.contents.toString().concat(newRulesStr);
            file.contents = new Buffer(data);

            this.push(file);
        } catch (err) {
            this.emit('error', new PluginError(pluginName, err));
        }

        cb();
    });
};