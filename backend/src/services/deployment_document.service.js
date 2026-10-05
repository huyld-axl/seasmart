const path = require('path')
const fs = require('fs')
const xlsx = require('xlsx')
const ExcelJS = require('exceljs')
const PizZip = require('pizzip')
const Docxtemplater = require('docxtemplater')
const dayjs = require('dayjs')
const pool = require('../config/db')

const TEMPLATES_DIR = path.join(__dirname, '../templates/documents')
const FORMS_DIR = path.resolve(__dirname, '../../../../forms')

function escapeXml(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function getData(deploymentId) {
  const [deps] = await pool.query(
    `SELECT sd.*, r.code AS rank_code, r.name_vi AS rank_name,
            s.full_name, s.date_of_birth, s.place_of_birth,
            s.phone_primary, s.permanent_address, s.contact_address,
            s.national_id, s.national_id_issued_date, s.national_id_issued_place,
            s.passport_number, s.passport_issued_date, s.passport_expiry,
            s.height_cm, s.weight_kg, s.shoe_size,
            p.company_name AS partner_name
     FROM seafarer_deployment sd
     LEFT JOIN seafarer s ON s.id = sd.seafarer_id
     LEFT JOIN rank r ON r.id = sd.rank_id
     LEFT JOIN job j ON j.id = sd.job_id
     LEFT JOIN partner p ON p.id = j.partner_id
     WHERE sd.id = ?`,
    [deploymentId]
  )
  if (!deps[0]) throw { statusCode: 404, message: 'Không tìm thấy điều động' }
  const dep = deps[0]

  const [certs] = await pool.query(
    `SELECT sc.certificate_number, sc.expiry_date, sc.notes,
            ct.name_en, ct.name_vi, ct.code
     FROM seafarer_certificate sc
     LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
     WHERE sc.seafarer_id = ? AND sc.deleted_at IS NULL
     ORDER BY ct.code`,
    [dep.seafarer_id]
  )

  return { dep, certs }
}

const deploymentDocumentService = {
  async generateBBGiaoNhan(deploymentId) {
    const { dep, certs } = await getData(deploymentId)

    const uploadedPath = path.join(FORMS_DIR, 'BB GIAO NHẬN GIẤY TỜ TV.xlsx')
    const templatePath = fs.existsSync(uploadedPath)
      ? uploadedPath
      : path.join(TEMPLATES_DIR, 'bb_giao_nhan_template.xlsx')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(templatePath)
    const ws = workbook.getWorksheet('Sheet3')

    const name = dep.full_name || ''
    const dobStr = dep.date_of_birth
      ? dayjs(dep.date_of_birth).format('DD-MMM-YY').toUpperCase()
      : ''

    ws.getCell('I7').value = name
    ws.getCell('AA7').value = dep.rank_code || ''
    ws.getCell('AK7').value = dobStr
    ws.getCell('AS7').value = name
    if (dep.height_cm) ws.getCell('I8').value = dep.height_cm
    if (dep.weight_kg) ws.getCell('R8').value = dep.weight_kg
    if (dep.shoe_size) ws.getCell('AK8').value = dep.shoe_size
    ws.getCell('I9').value = dep.phone_primary || ''
    ws.getCell('I10').value = dep.permanent_address || dep.contact_address || ''
    ws.getCell('H37').value = dayjs().format('DD/MM/YYYY')

    // Build lookup map from seafarer's actual certs (by name_en and name_vi)
    const certMap = new Map()
    for (const cert of certs) {
      const key = (cert.name_en || cert.name_vi || '').toLowerCase().trim()
      if (key) certMap.set(key, cert)
    }

    // Match template doc rows against actual certs — only update quantity column
    let totalMatched = 0
    for (let row = 14; row <= 35; row++) {
      const docNameCell = ws.getCell(`D${row}`)
      if (!docNameCell.value) continue
      const key = String(docNameCell.value).toLowerCase().trim()
      const matched = certMap.get(key)
      ws.getCell(`AA${row}`).value = matched ? 1 : null
      if (matched) {
        totalMatched++
        ws.getCell(`AE${row}`).value = matched.expiry_date
          ? dayjs(matched.expiry_date).format('DD-MMM-YY').toUpperCase()
          : null
      }
    }

    ws.getCell('AA36').value = totalMatched

    return workbook.xlsx.writeBuffer()
  },

  async generateHopDongDanSu(deploymentId) {
    const { dep } = await getData(deploymentId)

    const templatePath = path.join(TEMPLATES_DIR, 'hop_dong_dan_su_template.docx')
    const content = fs.readFileSync(templatePath, 'binary')
    const zip = new PizZip(content)
    let xml = zip.files['word/document.xml'].asText()

    const name = escapeXml(dep.full_name || '')
    const dob = dep.date_of_birth ? dayjs(dep.date_of_birth).format('DD/MM/YYYY') : ''
    const address = escapeXml(dep.permanent_address || dep.contact_address || '')
    const cmnd = escapeXml(dep.national_id || '')
    const rank = escapeXml(dep.rank_code || dep.rank_name || '')

    // Inject seafarer name after "Ông:"
    xml = xml.replace('<w:t>Ông:</w:t>', `<w:t xml:space="preserve">Ông: ${name}</w:t>`)
    // Inject DOB after "Ngày sinh:"
    xml = xml.replace('<w:t>Ngày sinh:</w:t>', `<w:t xml:space="preserve">Ngày sinh: ${dob}</w:t>`)
    // Append address to "Chỗ ở hiện tại: "
    xml = xml.replace(
      '<w:t xml:space="preserve">Chỗ ở hiện tại: </w:t>',
      `<w:t xml:space="preserve">Chỗ ở hiện tại: ${address}</w:t>`
    )
    // Inject CMND after "Số CMND:"
    xml = xml.replace('<w:t>Số CMND:</w:t>', `<w:t xml:space="preserve">Số CMND: ${cmnd}</w:t>`)
    // Append rank to "Bằng chức danh: "
    xml = xml.replace(
      '<w:t xml:space="preserve">Bằng chức danh: </w:t>',
      `<w:t xml:space="preserve">Bằng chức danh: ${rank}</w:t>`
    )
    // Inject rank after "Chức danh đảm nhận:"
    xml = xml.replace(
      '<w:t>Chức danh đảm nhận:</w:t>',
      `<w:t xml:space="preserve">Chức danh đảm nhận: ${rank}</w:t>`
    )

    zip.file('word/document.xml', xml)
    return zip.generate({
      type: 'nodebuffer',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
  },

  async generateQuyetDinhDieuDong(deploymentId) {
    const { dep } = await getData(deploymentId)

    // Find sign-off seafarer: previous deployment on the same job (or vessel as fallback)
    let prevSeafarerName = ''
    if (dep.job_id) {
      const [prevRows] = await pool.query(
        `SELECT s.full_name
         FROM seafarer_deployment sd
         LEFT JOIN seafarer s ON s.id = sd.seafarer_id
         WHERE sd.job_id = ?
           AND sd.id != ?
         ORDER BY sd.created_at DESC
         LIMIT 1`,
        [dep.job_id, deploymentId]
      )
      if (prevRows[0]) {
        prevSeafarerName = prevRows[0].full_name || ''
      }
    } else if (dep.vessel_id || dep.vessel_name) {
      const condition = dep.vessel_id ? 'sd.vessel_id = ?' : 'sd.vessel_name = ?'
      const condParam = dep.vessel_id || dep.vessel_name
      const params = dep.join_date
        ? [condParam, deploymentId, dep.join_date]
        : [condParam, deploymentId]
      const [prevRows] = await pool.query(
        `SELECT s.full_name
         FROM seafarer_deployment sd
         LEFT JOIN seafarer s ON s.id = sd.seafarer_id
         WHERE (${condition})
           AND sd.id != ?
           ${dep.join_date ? 'AND sd.join_date < ?' : ''}
         ORDER BY sd.join_date DESC
         LIMIT 1`,
        params
      )
      if (prevRows[0]) {
        prevSeafarerName = prevRows[0].full_name || ''
      }
    }

    const templatePath = path.join(TEMPLATES_DIR, 'quyet_dinh_dieu_dong_template.docx')
    const content = fs.readFileSync(templatePath, 'binary')
    const zip = new PizZip(content)
    let xml = zip.files['word/document.xml'].asText()

    const name = escapeXml(dep.full_name || '')
    const vessel = escapeXml(dep.vessel_name || '')
    const rank = escapeXml(dep.rank_code || '')
    const joinDate = dep.join_date ? dayjs(dep.join_date).format('DD/MM/YYYY') : '...'
    const prevName = escapeXml(prevSeafarerName)

    // Replace sign-on seafarer name
    xml = xml.replace(/( viên nhập tàu\): )VUONG KIM LAN/, `$1${name}`)
    // Replace vessel name (standalone <w:t>HOANG HUY</w:t> in the sign-on line)
    xml = xml.replace('<w:t>HOANG HUY</w:t>', `<w:t>${vessel}</w:t>`)
    // Replace sign-off seafarer name with previous deployment's seafarer
    xml = xml.replace(
      'Crew sign off (thuyền viên rời tàu) NGUYEN BA ANH',
      `Crew sign off (thuyền viên rời tàu)${prevName ? ' ' + prevName : ''}`
    )
    // Replace rank of sign-off (C/0)
    xml = xml.replace(/(<w:t xml:space="preserve">) C\/0(<\/w:t>)/, `$1 ${rank}$2`)
    // Replace join date placeholder (text is split across two Word runs by proofErr)
    xml = xml.replace(
      /<w:t>\(kể từ ngày<\/w:t><\/w:r><w:proofErr[^/]*\/><w:r>[^<]*<w:rPr>[^<]*<w:rFonts[^/]*\/><\/w:rPr><w:t>\)\:\.\.<\/w:t><\/w:r><w:proofErr[^/]*\/><w:r>[^<]*<w:rPr>[^<]*<w:rFonts[^/]*\/><\/w:rPr><w:t>\/…\.\/202…\. Sign on/,
      `<w:t xml:space="preserve">(kể từ ngày ): ${joinDate}. Sign on`
    )

    zip.file('word/document.xml', xml)
    return zip.generate({
      type: 'nodebuffer',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
  },

  async generateHopDongMLC(deploymentId) {
    const { dep } = await getData(deploymentId)

    const uploadedPath = path.join(FORMS_DIR, 'MẪU HỢP ĐỒNG MLC.docx')
    const templatePath = fs.existsSync(uploadedPath)
      ? uploadedPath
      : path.join(TEMPLATES_DIR, 'hop_dong_mlc_template.docx')

    const content = fs.readFileSync(templatePath, 'binary')
    const zip = new PizZip(content)
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

    const fmt = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '')
    const salary = dep.salary
      ? `${Number(dep.salary).toLocaleString()} ${dep.salary_currency || 'USD'}`
      : ''
    const salaryActual = dep.salary_actual
      ? `${Number(dep.salary_actual).toLocaleString()} ${dep.salary_currency || 'USD'}`
      : ''

    doc.render({
      'tên thuyền viên': dep.full_name || '',
      DOB: fmt(dep.date_of_birth),
      'Quê quán': dep.place_of_birth || '',
      'passpost no': dep.passport_number || '',
      'ngày cấp hc': fmt(dep.passport_issued_date),
      'ngày hết hạn hc': fmt(dep.passport_expiry),
      'địa chỉ': dep.permanent_address || dep.contact_address || '',
      'thời gian lên tàu thuyền viên': fmt(dep.contract_start_date || dep.join_date),
      'thời gian sign-off': fmt(dep.contract_end_date || dep.sign_off_date),
      'tên tàu': dep.vessel_name || '',
      'cờ tàu': dep.vessel_flag || '',
      GT: dep.vessel_grt ? String(Math.round(dep.vessel_grt)) : '',
      'tên công ty đối tác': dep.partner_name || '',
      'mức lương': salary,
      'thực lĩnh': salaryActual,
    })

    return doc.getZip().generate({ type: 'nodebuffer' })
  },
}

module.exports = deploymentDocumentService
