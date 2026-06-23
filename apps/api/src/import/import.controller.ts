import {
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import { JwtAuthGuard, AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

type ArquivoUpload = { originalname: string; buffer: Buffer };

@Controller('import')
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(private readonly service: ImportService) {}

  // Recebe os relatórios (Airbnb .csv / Booking .xls) e processa no servidor.
  @Post()
  @UseInterceptors(FilesInterceptor('files', 20))
  importar(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: ArquivoUpload[],
  ) {
    return this.service.importar(user, files);
  }
}
