$sourceDir = "d:\dev\gmap\dealer-platform"
$destZip = "d:\dev\gmap\dealer-platform-update.zip"

Write-Host "开始打包项目更新..."
# 删除旧的更新包
if (Test-Path $destZip) {
    Remove-Item $destZip
}

# 使用 tar 进行压缩并排除不必要的文件和数据库文件
# 重要：排除 database.sqlite 以防止覆盖线上数据
tar -a -c -f $destZip --exclude=node_modules --exclude=.next --exclude=.git --exclude=database.sqlite -C $sourceDir .

Write-Host "打包完成！更新包位置: $destZip"
Write-Host "请将此文件上传到服务器的 /opt/dealer 目录中，然后运行 ./update.sh"
