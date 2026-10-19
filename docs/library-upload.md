# 附件索引分块写入

大 library.json 不再通过连接器 update_file 或单个 create_blob 直接上传。完整扫描、元数据合并和 fileId 去重完成后，将待写 JSON 保存至本机文件，运行：

`node scripts/prepare_library_upload.mjs <prepared.json> <扫描时library的blob SHA> <本机输出目录>`

通过 GitHub 连接器逐个 create_blob 上传 package.json 的 entries，每次正文最多24000字符；将待上传的脚本/工作流变更与所有分块、manifest 一并 create_tree/create_commit，并以 expected_sha 非强制 update_ref。只有全部块准备好才更新分支；保存每个成功对象 SHA，中断后继续，不重复创建提交。

GitHub Actions 在正常研究构建前运行 apply_library_upload.py：检查原 library blob SHA、每块 SHA256、完整解压字节数/SHA256、fileId 唯一性和历史ID保留，全部通过后原子替换 library，生成 library-sync-receipt.json，然后正常构建资源索引。源文件并发变化、块缺失或校验失败时保留队列并使构建失败，不覆盖文件。

提交后回读 library-sync-receipt.json、父目录 library.json 的 blob SHA/字节数、resource-index 及 Actions/Pages 状态。无需将完整索引传入模型。尚未构建/部署的批次保留阶段，不能报告已上线。

当前待恢复批次及上传断点位于本机 work/library-refresh/upload；本机 state 不提交。
