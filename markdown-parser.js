const fs = require('fs-extra');
const path = require('path');
const fm = require('front-matter');
const markdownIt = require('markdown-it');
const hljs = require('highlight.js');

class MarkdownParser {
    constructor() {
        this.md = markdownIt({
            html: true,
            linkify: true,
            typographer: true
        });

        const escapeHtml = this.md.utils.escapeHtml;

        // 自定义渲染：围栏代码块（```lang）
        const renderFence = (tokens, idx) => {
            const token = tokens[idx];
            const info = token.info ? token.info.trim() : '';
            const lang = info.split(/\s+/)[0] || '';
            const code = token.content || '';
            let highlighted;
            try {
                if (lang && hljs.getLanguage(lang)) {
                    highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
                } else {
                    highlighted = escapeHtml(code);
                }
            } catch (_) {
                highlighted = escapeHtml(code);
            }
            const langClass = lang ? ` language-${lang}` : '';
            return `<div class="code-block"><button class="copy-code-btn" type="button" aria-label="复制代码">复制</button><pre><code class="hljs${langClass}">${highlighted}</code></pre></div>`;
        };

        // 自定义渲染：缩进代码块（四空格）
        const renderCodeBlock = (tokens, idx) => {
            const code = tokens[idx].content || '';
            const highlighted = escapeHtml(code);
            return `<div class="code-block"><button class="copy-code-btn" type="button" aria-label="复制代码">复制</button><pre><code class="hljs">${highlighted}</code></pre></div>`;
        };

        this.md.renderer.rules.fence = renderFence;
        this.md.renderer.rules.code_block = renderCodeBlock;

        const defaultImageRender = this.md.renderer.rules.image || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
        this.md.renderer.rules.image = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            if (token && typeof token.attrJoin === 'function') {
                token.attrJoin('class', 'progressive-media');
                if (typeof token.attrGet === 'function' && typeof token.attrSet === 'function' && !token.attrGet('loading')) {
                    token.attrSet('loading', 'lazy');
                }
            }
            return defaultImageRender(tokens, idx, options, env, self);
        };
    }

    /**
     * 解析Markdown文件，提取front-matter和内容
     * @param {string} filePath - Markdown文件路径
     * @returns {Object} 包含属性和内容的对象
     */
    parseFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = fm(content);
        
        // 移除正文中的第一个H1标题，避免与模板标题重复
        const bodyWithoutFirstH1 = this.removeFirstH1(parsed.body || '');
        
        return {
            attributes: parsed.attributes || {},
            body: parsed.body || '',
            html: this.md.render(bodyWithoutFirstH1)
        };
    }

    /**
     * 移除markdown内容中的第一个H1标题
     * @param {string} markdown - markdown内容
     * @returns {string} 移除第一个H1后的内容
     */
    removeFirstH1(markdown) {
        // 按行分割
        const lines = markdown.split('\n');
        let firstH1Found = false;
        const filteredLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 检查是否是H1标题 (# 开头，但不是 ## 或更多#)
            if (!firstH1Found && /^# [^#]/.test(line)) {
                firstH1Found = true;
                continue; // 跳过这一行
            }
            
            filteredLines.push(lines[i]);
        }
        
        return filteredLines.join('\n');
    }

    /**
     * 获取所有Markdown文件
     * @param {string} dir - 目录路径
     * @returns {Array} Markdown文件路径数组
     */
    getMarkdownFiles(dir) {
        const files = fs.readdirSync(dir);
        const markdownFiles = [];

        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // 递归处理子目录
                markdownFiles.push(...this.getMarkdownFiles(fullPath));
            } else if (path.extname(file).toLowerCase() === '.md') {
                markdownFiles.push(fullPath);
            }
        });

        return markdownFiles;
    }
}

module.exports = MarkdownParser;
