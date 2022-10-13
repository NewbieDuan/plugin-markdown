const path = require('path');
const fs = require('fs');
const MarkdownIt = require('markdown-it');
import { Plugin } from "vite";

const md = new MarkdownIt()
const vueReg = /\.vue$/;
const markdownReg = /\<d-markdown.*\/d-markdown\>/g;
const filePathReg = /(?<=file=("|')).*(?=('|"))/;

const mdRelationMap = new Map<string, string>()

const transformMarkdown = (mdText:string) => {
    return `
        <section class="article-content">
            ${md.render(mdText)}
        </section>
    `
}

export default function markdownPlugin(): Plugin {
    return {
        name: 'vite:markdown',
        enforce: 'pre',
        transform(code, id, opt) {
            if (!vueReg.test(id) || !code.match(markdownReg)) {
                return code;
            }
            let transformCode = code;
            const mdList = code.match(markdownReg);
            mdList?.forEach(md => {
                const fileRelativePaths = md.match(filePathReg);
                if (!fileRelativePaths?.length) return
                const fileRelativePath = fileRelativePaths[0];
                const fileDir = path.dirname(id);
                const filePath = path.resolve(fileDir, fileRelativePath);
                const mdText = fs.readFileSync(filePath, 'utf-8');
                transformCode = transformCode.replace(md, transformMarkdown(mdText));
                mdRelationMap.set(filePath, id)
            });
            return transformCode
        },
        handleHotUpdate(ctx) {
            const { file, server, modules } = ctx;
            if (path.extname(file) !== '.md') return
            const filepath = path.resolve(file);
            const relationId = mdRelationMap.get(filepath) as string;
            const relationModule = [...server.moduleGraph.getModulesByFile(relationId)!][0];
            server.ws.send({
                type: 'update',
                updates: [
                    {
                        type: 'js-update',
                        path: relationModule.file!,
                        acceptedPath: relationModule.file!,
                        timestamp: new Date().getTime()
                    }
                ]
            });
            return [...modules, relationModule]
        }
    }
}
// module.exports = markdownPlugin;
// markdownPlugin['default'] = markdownPlugin;