import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { ImageExtractor } from './extractors/image.extractor';
import { PdfExtractor } from './extractors/pdf.extractor';
import { CsvExtractor } from './extractors/csv.extractor';
import { ExcelExtractor } from './extractors/excel.extractor';
import { TextExtractor } from './extractors/text.extractor';

@Module({
  providers: [
    FilesService,
    ImageExtractor,
    PdfExtractor,
    CsvExtractor,
    ExcelExtractor,
    TextExtractor,
  ],
  exports: [
    FilesService,
    ImageExtractor,
    PdfExtractor,
    CsvExtractor,
    ExcelExtractor,
    TextExtractor,
  ],
})
export class FilesModule {}
